export async function handleAddressSearch(request, ctx, jsonResponse) {
  const { env, origin } = ctx;
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);

  if (query.length < 2) {
    return jsonResponse({ results: [] }, 200, origin, env);
  }

  const db = ctx.env.DB;

  try {
    const searchTerm = `%${query}%`;

    const { results } = await db
      .prepare(
        `
        SELECT
          rowid          AS id,
          SUBURB         AS suburb,
          AREA           AS city,
          "STR-CODE"     AS str_code,
          "BOX-CODE"     AS box_code
        FROM postal_codes
        WHERE
          SUBURB        LIKE ?1
          OR AREA       LIKE ?1
          OR "STR-CODE" LIKE ?1
          OR "BOX-CODE" LIKE ?1
        ORDER BY
          CASE WHEN SUBURB LIKE ?2 THEN 0
               WHEN AREA   LIKE ?2 THEN 1
               ELSE 2
          END,
          SUBURB ASC
        LIMIT ?3
        `
      )
      .bind(searchTerm, `${query}%`, limit)
      .all();

    const mapped = results.map((row) => {
      const postalCode = row.str_code || row.box_code || "";
      return {
        id: row.id,
        suburb: row.suburb ?? "",
        city: row.city ?? "",
        postal_code: postalCode,
        display_name: [row.suburb, row.city, postalCode].filter(Boolean).join(", "),
      };
    });

    return jsonResponse({ results: mapped }, 200, origin, env);
  } catch (err) {
    console.error("[address-search] D1 error:", err);
    return jsonResponse({ error: 'Search failed', details: err.message }, 500, origin, env);
  }
}
