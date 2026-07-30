export type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1";
  contract_type?: string;
  created: string;
  category: { tag: string; label: string };
};

// A short, explicit list, not a geocoder: Adzuna only needs a country code,
// and this project's location field is optional free text, most often a US
// city or blank. Anything not matched here defaults to "us".
const COUNTRY_KEYWORDS: Array<{ country: string; keywords: string[] }> = [
  { country: "gb", keywords: ["london", "uk", "united kingdom", "england", "scotland", "wales"] },
  { country: "au", keywords: ["sydney", "melbourne", "australia"] },
  { country: "ca", keywords: ["toronto", "vancouver", "canada"] },
];

export function detectCountry(location: string): string {
  const normalized = location.toLowerCase();

  for (const { country, keywords } of COUNTRY_KEYWORDS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return country;
    }
  }

  return "us";
}

export async function searchJobs(
  jobTitle: string,
  location: string,
  country: string = "us",
): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    what: jobTitle,
    category: "it-jobs",
    results_per_page: "10",
    "content-type": "application/json",
  });

  if (location) {
    params.set("where", location);
  }

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
  );

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}
