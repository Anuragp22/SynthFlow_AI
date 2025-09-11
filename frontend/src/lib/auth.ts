import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "~/server/db";
import { Polar } from "@polar-sh/sdk";
import { env } from "~/env";
import {
  polar,
  checkout,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";

const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
});

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId: "e5e4606c-6064-48c4-9464-6838b250a248",
              slug: "small",
            },
            {
              productId: "74c7860d-6374-4544-8fa7-dd7bf6a1b2cb",
              slug: "medium",
            },
            {
              productId: "c7e3bd0b-fe56-42c6-ab85-1c56a210ce8c",
              slug: "large",
            },
          ],
          successUrl: "/",
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET,
          onOrderPaid: async (order) => {
            const externalCustomerId = order.data.customer.externalId;

            if (!externalCustomerId) {
              console.error("No external customer ID found.");
              throw new Error("No external customer id found.");
            }

            const productId = order.data.productId;

            let creditsToAdd = 0;
            
            switch (productId) {
              case "e5e4606c-6064-48c4-9464-6838b250a248":    // Small
                creditsToAdd = 10;
                break;  
              case "74c7860d-6374-4544-8fa7-dd7bf6a1b2cb":   // Medium
                creditsToAdd = 25;
                break;
              case "c7e3bd0b-fe56-42c6-ab85-1c56a210ce8c":   // Large 
                creditsToAdd = 50;
                break;
            }

            await db.user.update({
              where: { id: externalCustomerId },
              data: {
                credits: {
                  increment: creditsToAdd,
                },
              },
            });
          },
        }),
      ],
    }),
  ],
});