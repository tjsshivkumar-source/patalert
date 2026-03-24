import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { Patent, ScanResult } from '@/lib/types';

const client = new Anthropic();

async function extractElements(imageBase64: string, mediaType: string, description: string) {
  const content: Anthropic.MessageParam['content'] = [];

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 }
    });
  }

  content.push({
    type: 'text',
    text: `You are a design patent expert. Analyze this fashion/product${imageBase64 ? ' image and' : ''} description: "${description}"

Return ONLY valid JSON, no markdown fences:
{
  "category": "apparel|footwear|handbag|accessory|jewelry|eyewear|other",
  "silhouette": "overall shape and proportions in one sentence",
  "surface_pattern": "surface ornamentation, texture, or pattern — or none",
  "hardware": "hardware elements and their placement — or none",
  "seam_lines": "stitching patterns and panel construction — or none",
  "distinctive_elements": ["3-5 most distinctive ornamental features as short phrases"],
  "search_keywords": ["6-8 specific USPTO search keywords focused on visual/ornamental terms"],
  "known_risks": "any elements visually resembling famous protected designs — or none"
}`
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function searchUSPTO(keywords: string[], elements: any): Promise<{ patents: Patent[]; source: 'live' | 'training' }> {
  const trySearch = async (kws: string[]): Promise<Patent[]> => {
    const queryStr = kws.join(' AND ');
    console.log('[USPTO] POST query:', queryStr);

    const res = await fetch(
      'https://api.uspto.gov/api/v1/patent/applications/search',
      {
        method: 'POST',
        headers: {
          'X-Api-Key': process.env.USPTO_API_KEY!,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          q: queryStr,
          filters: [{ name: 'applicationMetaData.applicationTypeLabelName', value: ['Design'] }],
          sort: [{ field: 'applicationMetaData.filingDate', order: 'desc' }],
          fields: ['applicationNumberText','applicationMetaData.inventionTitle','applicationMetaData.filingDate','applicationMetaData.firstApplicantName','applicationMetaData.applicantBag','applicationMetaData.applicationStatusDescriptionText','applicationMetaData.patentNumber'],
          pagination: { offset: 0, limit: 8 }
        }),
        signal: AbortSignal.timeout(8000)
      }
    );

    if (res.status === 404) {
      console.log('[USPTO] 404 — no matching records');
      return [];
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[USPTO] POST failed', res.status, body.slice(0, 300));
      throw new Error('USPTO HTTP ' + res.status);
    }
    const data = await res.json();
    const bag = data.patentFileWrapperDataBag;
    if (!bag || !Array.isArray(bag)) return [];

    return bag.map((p: any) => {
      const meta = p.applicationMetaData || {};
      const appNum = p.applicationNumberText || '';
      const patentNum = meta.patentNumber || null;
      return {
        id: appNum || 'pat_' + Math.random().toString(36).slice(2),
        title: meta.inventionTitle || 'Design Patent',
        filingDate: meta.filingDate || 'Unknown',
        assignee: meta.firstApplicantName || meta.applicantBag?.[0]?.applicantNameText || 'Unknown',
        status: meta.applicationStatusDescriptionText || 'Unknown',
        patentNumber: patentNum,
        googlePatentsUrl: patentNum
          ? `https://patents.google.com/patent/US${patentNum}S1`
          : `https://patents.google.com/?q=${encodeURIComponent(meta.inventionTitle || 'design')}&assignee=${encodeURIComponent(meta.firstApplicantName || '')}&type=DESIGN`,
        similarityReason: ''
      };
    });
  };

  const categoryMap: Record<string, string[]> = {
    footwear: ['shoe', 'footwear', 'sandal', 'boot', 'heel'],
    handbag: ['handbag', 'bag', 'purse', 'tote'],
    apparel: ['garment', 'dress', 'shirt', 'jacket', 'clothing'],
    accessory: ['accessory', 'belt', 'wallet', 'strap'],
    jewelry: ['jewelry', 'ring', 'necklace', 'bracelet'],
    eyewear: ['eyewear', 'glasses', 'sunglasses'],
    other: ['ornament', 'design']
  };

  const category = elements.category || 'other';
  const categoryTerms = categoryMap[category] || categoryMap.other;

  const descriptiveTokens = keywords
    .join(' ')
    .split(' ')
    .filter(w => w.length > 4)
    .filter(w => !['design', 'patent', 'leather', 'silhouette',
                    'pointed', 'finish', 'material'].includes(w.toLowerCase()))
    .slice(0, 2);

  const tokens = [...categoryTerms.slice(0, 2), ...descriptiveTokens];

  try {
    // First attempt: category terms + descriptive tokens
    let patents = await trySearch(tokens.slice(0, 4));

    // Fallback: just category terms
    if (patents.length === 0) {
      patents = await trySearch(categoryTerms.slice(0, 2));
    }

    if (patents.length > 0) return { patents, source: 'live' };
    return { patents: [], source: 'training' };
  } catch (e) {
    console.error('USPTO search failed:', e);
    return { patents: [], source: 'training' };
  }
}

async function assessRisk(elements: any, patents: Patent[], source: 'live' | 'training'): Promise<ScanResult> {
  const patentContext = patents.length > 0
    ? `LIVE USPTO DESIGN PATENTS FOUND:\n${patents.map((p, i) => `${i + 1}. "${p.title}" — Filed: ${p.filingDate} — Assignee: ${p.assignee} — ID: ${p.id}`).join('\n')}`
    : `No USPTO results returned. Use your training knowledge of well-known fashion design patents to assess risk. Cite specific real patent numbers where relevant (e.g. Chanel D432220, Nike D723640, Louboutin D505085).`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a design patent attorney conducting a freedom-to-operate analysis for a fashion product.

PRODUCT ORNAMENTAL ELEMENTS:
- Category: ${elements.category}
- Silhouette: ${elements.silhouette}
- Surface Pattern: ${elements.surface_pattern}
- Hardware: ${elements.hardware}
- Seam Lines: ${elements.seam_lines}
- Distinctive Elements: ${(elements.distinctive_elements || []).join(', ')}
- Known Risk Flags: ${elements.known_risks}

${patentContext}

Return ONLY valid JSON, no markdown fences:
{
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": 0-100,
  "summary": "2-3 sentence plain English risk summary for a designer audience",
  "elementRisks": [
    { "element": "element name", "risk": "LOW|MEDIUM|HIGH", "reasoning": "specific reason in one sentence" }
  ],
  "patentAssessments": [
    { "patentId": "exact ID from the list above", "similarityReason": "brief specific visual similarity explanation", "recommendedAction": "one actionable step" }
  ],
  "recommendations": ["specific actionable recommendation 1", "recommendation 2", "recommendation 3"],
  "disclaimer": "This is AI-assisted preliminary analysis only. Consult qualified IP counsel before making product or manufacturing decisions."
}`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const assessment = JSON.parse(text.replace(/```json|```/g, '').trim());

  // Merge similarity reasons back into patent objects
  const enrichedPatents = patents.map(p => {
    const a = (assessment.patentAssessments || []).find((pa: any) => pa.patentId === p.id);
    return {
      ...p,
      similarityReason: a?.similarityReason || 'Ornamental similarity detected via USPTO search.'
    };
  });

  return {
    riskLevel: assessment.riskLevel || 'LOW',
    riskScore: Number(assessment.riskScore) || 0,
    summary: assessment.summary || '',
    elementRisks: assessment.elementRisks || [],
    patents: enrichedPatents,
    recommendations: assessment.recommendations || [],
    disclaimer: assessment.disclaimer || '',
    dataSource: source
  };
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, description } = await req.json();
    console.log('[SCAN] Request received — image:', !!imageBase64, '| description:', description?.slice(0, 60));

    if (!description && !imageBase64) {
      return NextResponse.json({ error: 'Provide a description or image' }, { status: 400 });
    }

    console.log('[SCAN] Step 1/3 — Extracting elements via Claude...');
    const elements = await extractElements(imageBase64 || '', mediaType || 'image/jpeg', description || '');
    console.log('[SCAN] Elements:', JSON.stringify(elements, null, 2));

    console.log('[SCAN] Step 2/3 — Searching USPTO with keywords:', elements.search_keywords);
    const { patents, source } = await searchUSPTO(elements.search_keywords || [], elements);
    console.log(`[SCAN] USPTO returned ${patents.length} patents (source: ${source})`);

    console.log('[SCAN] Step 3/3 — Assessing risk via Claude...');
    const result = await assessRisk(elements, patents, source);
    console.log(`[SCAN] Done — Risk: ${result.riskLevel} (${result.riskScore}/100)`);

    return NextResponse.json({ result });
  } catch (err: any) {
    console.error('Scan error:', err);
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 });
  }
}
