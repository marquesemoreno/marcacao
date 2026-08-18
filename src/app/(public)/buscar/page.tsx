import { redirect } from "next/navigation";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function SearchPageRedirect({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined)
  ).toString();

  redirect(`/procedimentos${queryString ? `?${queryString}` : ""}`);
}
