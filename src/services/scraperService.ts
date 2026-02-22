import axios from 'axios';
import * as cheerio from 'cheerio';

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

    // Extract text from body
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // Limit text length to avoid token limits (e.g., first 10000 chars should be enough for project details)
    return text.slice(0, 10000);
  } catch (error) {
    console.error('Error scraping URL:', error);
    throw new Error('Failed to scrape the provided URL.');
  }
};
