'use server';
/**
 * @fileOverview A Genkit flow for customer segmentation and targeted marketing suggestions.
 *
 * - customerMarketingAssistant - A function that processes customer dining history to suggest segments, offers, and menu items.
 * - CustomerMarketingAssistantInput - The input type for the customerMarketingAssistant function.
 * - CustomerMarketingAssistantOutput - The return type for the customerMarketingAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CustomerMarketingAssistantInputSchema = z.object({
  customerId: z.string().describe('The unique identifier for the customer.'),
  diningHistory: z.array(
    z.object({
      orderId: z.string().describe('Unique identifier for the order.'),
      itemsOrdered: z
        .array(z.string())
        .describe('List of menu items ordered in this transaction.'),
      totalSpent: z.number().describe('Total amount spent in this order.'),
      orderDate: z.string().describe('ISO date string of the order.'),
    })
  ).describe('An array of the customer\u0027s past dining transactions.'),
  availableOffers: z
    .array(z.string())
    .describe('A list of currently available marketing offers (e.g., "10% off next meal", "Free dessert with any main course").'),
  menuHighlights: z
    .array(z.string())
    .describe('A list of special or new menu items to highlight.'),
});
export type CustomerMarketingAssistantInput = z.infer<
  typeof CustomerMarketingAssistantInputSchema
>;

const CustomerMarketingAssistantOutputSchema = z.object({
  customerSegment: z
    .string()
    .describe('A descriptive segment for the customer (e.g., "Frequent Diner", "Vegetarian Enthusiast", "Dessert Lover", "New Customer").'),
  targetedOffer: z
    .string()
    .describe('A specific offer from the available offers, tailored to the customer\u0027s segment.'),
  recommendedMenuItem: z
    .string()
    .describe('A specific menu item from the menu highlights, recommended based on the customer\u0027s preferences.'),
  reasoning: z
    .string()
    .describe('An explanation of why the customer was segmented this way and why the offer/menu item were recommended.'),
});
export type CustomerMarketingAssistantOutput = z.infer<
  typeof CustomerMarketingAssistantOutputSchema
>;

export async function customerMarketingAssistant(
  input: CustomerMarketingAssistantInput
): Promise<CustomerMarketingAssistantOutput> {
  return customerMarketingAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'customerSegmentationPrompt',
  input: {schema: CustomerMarketingAssistantInputSchema},
  output: {schema: CustomerMarketingAssistantOutputSchema},
  prompt: `You are an AI marketing assistant for a restaurant. Your task is to analyze a customer's dining history, identify their dining patterns and preferences, segment them, and suggest a targeted offer and a recommended menu item from the provided lists.

### Customer Information:
Customer ID: {{{customerId}}}

### Dining History:
{{#each diningHistory}}
  Order ID: {{{this.orderId}}}
  Items Ordered: {{#each this.itemsOrdered}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  Total Spent: {{{this.totalSpent}}}
  Order Date: {{{this.orderDate}}}
{{/each}}

### Available Offers:
{{#each availableOffers}}
- {{{this}}}
{{/each}}

### Menu Highlights:
{{#each menuHighlights}}
- {{{this}}}
{{/each}}

Based on the above information, determine the best customer segment, select the most appropriate targeted offer from the 'Available Offers' list, and recommend a menu item from the 'Menu Highlights' list. Provide a concise reasoning for your choices. Do not invent new offers or menu items.`,
});

const customerMarketingAssistantFlow = ai.defineFlow(
  {
    name: 'customerMarketingAssistantFlow',
    inputSchema: CustomerMarketingAssistantInputSchema,
    outputSchema: CustomerMarketingAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
