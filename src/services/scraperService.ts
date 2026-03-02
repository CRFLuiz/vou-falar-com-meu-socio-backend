import axios from 'axios';
import * as cheerio from 'cheerio';
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

export const scrapeProjectUrl = async (url: string): Promise<string> => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const $ = cheerio.load(data);

    // Remove scripts, styles, and other non-content elements
    $('script').remove();
    $('style').remove();
    $('nav').remove();
    $('footer').remove();
    $('header').remove();
    $('iframe').remove();
    $('noscript').remove();

    // Process links to include URLs in text so the AI can see them
    $('a').each((_, element) => {
      const el = $(element);
      const href = el.attr('href');
      const text = el.text().trim();
      
      if (href && text) {
        try {
          // Resolve relative URLs
          const absoluteUrl = new URL(href, url).toString();
          // Replace link with "Text (URL)" format to make it visible to the AI
          el.replaceWith(`${text} (Link: ${absoluteUrl})`);
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    });

    // Extract text from body
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // Limit text length to avoid token limits (e.g., first 10000 chars should be enough for project details)
    return text.slice(0, 10000);
  } catch (error) {
    console.error('Error scraping URL:', error);
    throw new Error('Failed to scrape the provided URL.');
  }
};

export const scrapeUrlTool = new DynamicStructuredTool({
  name: "scrape_url",
  description: "Scrapes the content of a given URL. Use this to get information from client profiles, company pages, or other relevant links found in the project description.",
  schema: z.object({
    url: z.string().describe("The URL to scrape"),
  }),
  func: async ({ url }) => {
    try {
        console.log(`Tool 'scrape_url' invoked for: ${url}`);
        return await scrapeProjectUrl(url);
    } catch (error) {
        return `Failed to scrape ${url}: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});
