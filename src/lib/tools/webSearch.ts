export interface WebSearchResultItem {
  id?: number | string;
  title: string;
  url: string;
  content: string;
  snippet: string;
}

export interface WebSearchOutput {
  success: boolean;
  query: string;
  results: WebSearchResultItem[];
  error?: string;
}

/**
 * Searches the live public web using the Exa Search API.
 * Retrieves top relevant pages along with text content for grounding the LLM.
 */
export async function webSearch(query: string, numResults: number = 5): Promise<WebSearchOutput> {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      query,
      results: [],
      error: 'EXA_API_KEY is not configured in .env. Please set your Exa API key to enable live web search.',
    };
  }

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        type: 'auto',
        numResults: Math.min(numResults, 10),
        contents: {
          text: {
            maxCharacters: 4000,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        query,
        results: [],
        error: `Exa search API responded with status ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    const rawResults = data.results || [];

    const formattedResults: WebSearchResultItem[] = rawResults.map((item: any, idx: number) => {
      const fullText = item.text || item.content || '';
      const snippet = fullText.length > 250 ? fullText.substring(0, 250).trim() + '...' : fullText;

      return {
        id: item.id || idx + 1,
        title: item.title || 'Web Result',
        url: item.url || '',
        content: fullText,
        snippet,
      };
    });

    return {
      success: true,
      query,
      results: formattedResults,
    };
  } catch (error: any) {
    console.error('Exa webSearch error:', error);
    return {
      success: false,
      query,
      results: [],
      error: error.message || 'Failed to connect to Exa search API.',
    };
  }
}
