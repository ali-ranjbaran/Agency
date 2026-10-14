/** Approved shas in approval order (re-approving older text counts again; snapshot rows don't). */
export const approvedShas = (reviews: { content_sha: string; status: string }[]) => reviews.filter((r) => r.status === "approved").map((r) => r.content_sha);
