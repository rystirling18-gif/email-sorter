import type { Profile } from "./types";

/** Sample identity used to file the bundled mailbox. Replace these in Settings. */
export const defaultProfile: Profile = {
  name: "Ryan",
  emails: ["ryan@rsdigital.example", "ryan.personal@example.com"],
  businessName: "RS Digital Services",
  businessAliases: ["rs digital services", "rs digital"],
  schoolDomains: ["riverside.sch.uk"],
  knownClients: [
    { name: "Anna Chen", email: "anna@harbourandco.example" },
    { name: "Joel Adeyemi", email: "joel@northline.example" },
  ],
};

export function normaliseProfile(profile: Profile): Profile {
  return {
    name: profile.name.trim() || "Ryan",
    emails: unique(profile.emails.map(cleanEmail).filter(Boolean)),
    businessName: profile.businessName.trim() || "RS Digital Services",
    businessAliases: unique(
      [profile.businessName, ...profile.businessAliases]
        .map((alias) => alias.trim().toLowerCase())
        .filter((alias) => alias.length > 2),
    ),
    schoolDomains: unique(
      profile.schoolDomains.map((domain) => domain.trim().toLowerCase().replace(/^@/, "")).filter(Boolean),
    ),
    knownClients: profile.knownClients
      .map((client) => ({
        name: client.name.trim(),
        email: cleanEmail(client.email),
      }))
      .filter((client) => client.email.includes("@")),
  };
}

export function cleanEmail(value: string): string {
  return value.trim().toLowerCase().replace(/^mailto:/, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
