// app/sessions.server.js
import prisma from "./db.server.js";

export async function getAccessTokenForShop(shop) {
  // Presupunând că în sesiune stochezi shop și accessToken
  const session = await prisma.session.findFirst({
    where: { shop },
    select: { accessToken: true },
  });
  return session?.accessToken || null;
}
