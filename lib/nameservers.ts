/** Predefined DNS resolvers for the lookup form. */
export const NAMESERVERS = [
  { id: "cloudflare", label: "Cloudflare", ip: "1.1.1.1" },
  { id: "google", label: "Google", ip: "8.8.8.8" },
  { id: "quad9", label: "Quad9", ip: "9.9.9.9" },
  { id: "opendns", label: "OpenDNS", ip: "208.67.222.222" },
  { id: "custom", label: "Custom", ip: "" },
] as const;

export type NameserverId = (typeof NAMESERVERS)[number]["id"];

export function getNameserverIp(id: NameserverId, customIp: string): string {
  const entry = NAMESERVERS.find((n) => n.id === id);
  if (!entry || entry.id === "custom") return customIp.trim();
  return entry.ip;
}
