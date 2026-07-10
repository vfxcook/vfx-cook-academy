import {
  createTrendingPrompt,
  deleteTrendingPrompt,
  updateTrendingPromptStatus,
} from "@/lib/admin-actions";
import { prisma } from "@/lib/prisma";

export default async function AdminPromptsPage() {
  const prompts = await prisma.trendingPrompt.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="admin-page-grid">
      <section className="card admin-operating-section admin-create-panel">
        <div className="admin-section-heading">
          <div>
            <p>Homepage</p>
            <h2>Add Trending Prompt</h2>
          </div>
        </div>
        <form action={createTrendingPrompt} className="admin-form-grid">
          <label>
            Title
            <input className="input" name="title" placeholder="Cinematic rain chase" required />
          </label>
          <label>
            Sort Order
            <input className="input" name="sortOrder" type="number" min="1" defaultValue="1" />
          </label>
          <label className="admin-form-wide">
            Image
            <input className="input" name="imageFile" type="file" accept="image/*" required />
          </label>
          <label className="admin-form-wide">
            Prompt Used
            <textarea
              className="textarea"
              name="prompt"
              rows={7}
              placeholder="Paste the exact image/video prompt used to create this result..."
              required
            />
          </label>
          <label className="admin-checkbox">
            <input name="isPublished" type="checkbox" defaultChecked />
            Publish on homepage
          </label>
          <button className="btn btn-primary admin-save-button" type="submit">
            Add Prompt Card
          </button>
        </form>
      </section>

      <section className="card admin-operating-section">
        <div className="admin-section-heading">
          <div>
            <p>Prompt Library</p>
            <h2>Homepage Cards</h2>
          </div>
          <span className="admin-count-pill">{prompts.length} cards</span>
        </div>

        <div className="admin-prompt-list">
          {prompts.length === 0 ? (
            <p className="muted">No prompt cards yet.</p>
          ) : (
            prompts.map((prompt) => (
              <article key={prompt.id} className="admin-prompt-row">
                <img src={prompt.imageUrl} alt={prompt.title} />
                <div>
                  <strong>{prompt.title}</strong>
                  <p className="muted">Order {prompt.sortOrder} - {prompt.isPublished ? "Published" : "Hidden"}</p>
                  <p>{prompt.prompt.slice(0, 180)}{prompt.prompt.length > 180 ? "..." : ""}</p>
                </div>
                <div className="admin-doubt-actions">
                  <form action={updateTrendingPromptStatus}>
                    <input name="promptId" type="hidden" value={prompt.id} />
                    <input name="isPublished" type="hidden" value={prompt.isPublished ? "false" : "true"} />
                    <button className="btn btn-secondary" type="submit">
                      {prompt.isPublished ? "Hide" : "Publish"}
                    </button>
                  </form>
                  <form action={deleteTrendingPrompt}>
                    <input name="promptId" type="hidden" value={prompt.id} />
                    <button className="btn btn-secondary danger" type="submit">
                      Delete
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
