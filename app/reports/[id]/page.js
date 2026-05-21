import { redirect } from "next/navigation";

function appendSearchParams(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) {
          query.append(key, String(item));
        }
      }
      continue;
    }

    query.set(key, String(value));
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function ReportPageRedirect({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  redirect(`/reports/${resolvedParams.id}/layout${appendSearchParams(resolvedSearchParams)}`);
}

