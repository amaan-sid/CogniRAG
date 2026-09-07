/**
 * Tool definitions exposed to NVIDIA Nemotron 3 Super 120B.
 * Format adheres to OpenAI/NVIDIA function-calling specifications.
 */
export const agentTools = [
  {
    type: 'function',
    function: {
      name: 'internal_search',
      description:
        "Search the application's internal documents, uploaded PDFs, and private knowledge base stored in MongoDB.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up within internal documents and indexed PDF knowledge.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the public internet using Exa for current, recent, public, external, or time-sensitive information, news, live facts, and web pages.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The web search query to search across the live internet.',
          },
        },
        required: ['query'],
      },
    },
  },
] as const;
