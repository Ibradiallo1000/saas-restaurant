'use server';
/**
 * @fileOverview A Genkit flow for recommending dishes based on available inventory and customer dietary preferences.
 *
 * - dishRecommendationAssistant - A function that handles the dish recommendation process.
 * - DishRecommendationAssistantInput - The input type for the dishRecommendationAssistant function.
 * - DishRecommendationAssistantOutput - The return type for the dishRecommendationAssistant function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DishRecommendationAssistantInputSchema = z.object({
  availableInventory: z.array(z.string()).describe('A list of ingredients currently available in the kitchen.'),
  customerDietaryPreferences: z.string().optional().describe('Customer dietary restrictions or preferences (e.g., "vegetarian", "gluten-free", "nut allergy").'),
  customerPreferences: z.string().optional().describe('General customer preferences (e.g., "likes spicy food", "prefers light meals").'),
  existingMenu: z.array(
    z.object({
      name: z.string().describe('Name of the existing dish.'),
      description: z.string().describe('Description of the existing dish.'),
      ingredients: z.array(z.string()).describe('List of main ingredients for the existing dish.')
    })
  ).optional().describe('A list of dishes already on the menu with their ingredients, to consider adapting or suggesting.')
});
export type DishRecommendationAssistantInput = z.infer<typeof DishRecommendationAssistantInputSchema>;

const DishRecommendationAssistantOutputSchema = z.object({
  recommendedDishes: z.array(
    z.object({
      name: z.string().describe('Name of the recommended dish.'),
      description: z.string().describe('A brief description of the dish.'),
      ingredientsNeeded: z.array(z.string()).describe('List of ingredients from the available inventory required for this dish.'),
      isCustomDish: z.boolean().describe('True if this is a newly suggested dish, false if it is from the existing menu.'),
      reasonForRecommendation: z.string().describe('Explanation of why this dish is recommended.')
    })
  ).describe('An array of recommended dishes.')
});
export type DishRecommendationAssistantOutput = z.infer<typeof DishRecommendationAssistantOutputSchema>;

export async function dishRecommendationAssistant(input: DishRecommendationAssistantInput): Promise<DishRecommendationAssistantOutput> {
  return dishRecommendationAssistantFlow(input);
}

const dishRecommendationPrompt = ai.definePrompt({
  name: 'dishRecommendationPrompt',
  input: { schema: DishRecommendationAssistantInputSchema },
  output: { schema: DishRecommendationAssistantOutputSchema },
  prompt: `You are an expert chef and restaurant owner. Your task is to recommend dishes to a customer based on the available inventory and their dietary preferences.
Prioritize using ingredients from the available inventory to reduce food waste.
Adapt existing menu items or create new ones if necessary, ensuring they strictly adhere to the customer's preferences and can be made with the available ingredients.

Available Inventory:
{{#each availableInventory}}
- {{{this}}}
{{/each}}

{{#if existingMenu}}
Existing Menu Items (consider adapting these if suitable):
{{#each existingMenu}}
- Name: {{{name}}}
  Description: {{{description}}}
  Ingredients: {{#each ingredients}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
{{/each}}
{{/if}}

{{#if customerDietaryPreferences}}
Customer Dietary Preferences: {{{customerDietaryPreferences}}}
{{/if}}
{{#if customerPreferences}}
Customer General Preferences: {{{customerPreferences}}}
{{/if}}

Generate a list of dish recommendations in JSON format, strictly following the output schema. Ensure all recommended dishes can be made with the available inventory and satisfy the customer's dietary preferences and general preferences.
For each dish, provide its name, a brief description, the ingredients from the available inventory needed, whether it's a completely new/custom dish or an adaptation of an existing one, and a clear reason for its recommendation.`,
});

const dishRecommendationAssistantFlow = ai.defineFlow(
  {
    name: 'dishRecommendationAssistantFlow',
    inputSchema: DishRecommendationAssistantInputSchema,
    outputSchema: DishRecommendationAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await dishRecommendationPrompt(input);
    return output!;
  }
);
