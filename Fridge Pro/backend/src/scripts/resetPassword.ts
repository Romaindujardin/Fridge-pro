// Change le mot de passe d'un utilisateur (l'interface n'expose pas encore
// cette fonctionnalité). Utilise le DATABASE_URL de l'environnement.
//
// Usage (le mot de passe est demandé en saisie masquée) :
//   npx tsx src/scripts/resetPassword.ts <email>
//
// Pour la production (Neon), passer l'URL de la base cible :
//   DATABASE_URL="postgresql://...neon.tech/..." \
//     npx tsx src/scripts/resetPassword.ts demo@fridgepro.com

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Saisie masquée (le mot de passe ne s'affiche pas dans le terminal).
function promptHidden(query: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(query);

    if (!stdin.isTTY) {
      // Entrée non interactive : première ligne reçue.
      let data = "";
      stdin.on("data", (chunk) => {
        data += chunk.toString();
        if (data.includes("\n")) {
          resolve(data.split("\n")[0]);
        }
      });
      return;
    }

    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    let input = "";
    const onData = (buf: Buffer) => {
      const char = buf.toString("utf8");
      switch (char) {
        case "\r":
        case "\n":
        case "\u0004": // Ctrl+D
          stdin.removeListener("data", onData);
          stdin.setRawMode(Boolean(wasRaw));
          stdin.pause();
          stdout.write("\n");
          resolve(input);
          break;
        case "\u0003": // Ctrl+C
          stdout.write("\n");
          process.exit(1);
          break;
        case "\u007f": // Backspace
        case "\b":
          input = input.slice(0, -1);
          break;
        default:
          input += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error(
      "Usage: npx tsx src/scripts/resetPassword.ts <email de l'utilisateur>",
    );
    process.exit(1);
  }

  const password = await promptHidden(
    `Nouveau mot de passe pour ${email} (saisie masquée) : `,
  );

  if (password.length < 8) {
    console.error("❌ Le mot de passe doit contenir au moins 8 caractères.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email ${email}.`);
      process.exit(1);
    }

    await prisma.user.update({
      where: { email },
      data: { password: await bcrypt.hash(password, 12) },
    });

    console.log(`✅ Mot de passe mis à jour pour ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("❌ Erreur :", error);
  process.exit(1);
});
