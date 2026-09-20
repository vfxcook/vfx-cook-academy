import { useState, type FormEvent } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { Dialog, EmptyState, Field, Notice } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';

export async function adminPromptsLoader() {
  return api.admin.prompts();
}

export default function AdminPrompts() {
  const { prompts } = useLoaderData<typeof adminPromptsLoader>();
  const revalidator = useRevalidator();

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => revalidator.revalidate();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    const body = new FormData(event.currentTarget);
    body.set('isPublished', body.get('isPublished') ? 'true' : 'false');

    try {
      await api.admin.createPrompt(body);
      setCreating(false);
      refresh();
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not save that prompt.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head" style={{ paddingTop: 0 }}>
        <div className="ac-between" style={{ flexWrap: 'wrap' }}>
          <div>
            <p className="ac-eyebrow">Admin</p>
            <h1>Trending prompts</h1>
          </div>
          <button type="button" className="ac-btn ac-btn--primary" onClick={() => setCreating(true)}>
            New prompt
          </button>
        </div>
        <p className="ac-lede">
          Reference prompts with the frame they produced. Published ones are visible to students.
        </p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="ac-panel adm-card">
        {prompts.length === 0 ? (
          <EmptyState title="No prompts yet">
            Add a prompt with the still it produced to build the reference library.
          </EmptyState>
        ) : (
          <div className="ac-grid">
            {prompts.map(prompt => (
              <article key={prompt.id} className="adm-course" style={{ gridTemplateColumns: '1fr' }}>
                <div className="ac-media-frame" style={{ aspectRatio: '16 / 10' }}>
                  <img
                    src={prompt.imageUrl}
                    alt={prompt.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                </div>
                <div className="adm-course-body" style={{ marginTop: 10 }}>
                  <strong>{prompt.title}</strong>
                  <span className={`ac-chip ${prompt.isPublished ? 'ac-chip--ok' : 'ac-chip--warn'}`}>
                    {prompt.isPublished ? 'Live' : 'Hidden'}
                  </span>
                  <p className="adm-mini" style={{ lineHeight: 1.5 }}>
                    {prompt.prompt.slice(0, 180)}
                    {prompt.prompt.length > 180 ? '…' : ''}
                  </p>
                </div>
                <div className="adm-course-actions" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                  <button
                    type="button"
                    className="ac-btn ac-btn--quiet ac-btn--sm"
                    onClick={async () => {
                      try {
                        await api.admin.setPromptPublished(prompt.id, !prompt.isPublished);
                        refresh();
                      } catch (thrown) {
                        setError(errorMessage(thrown, 'Could not update that prompt.'));
                      }
                    }}
                  >
                    {prompt.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    className="ac-btn ac-btn--danger ac-btn--sm"
                    onClick={async () => {
                      try {
                        await api.admin.deletePrompt(prompt.id);
                        refresh();
                      } catch (thrown) {
                        setError(errorMessage(thrown, 'Could not delete that prompt.'));
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {creating ? (
        <Dialog title="New trending prompt" onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="ac-stack">
            <Field label="Title" htmlFor="p-title">
              <input id="p-title" name="title" className="ac-input" required />
            </Field>

            <Field label="Prompt" htmlFor="p-prompt" hint="The full prompt, exactly as it was run.">
              <textarea
                id="p-prompt"
                name="prompt"
                className="ac-textarea"
                style={{ minHeight: 140 }}
                required
                minLength={8}
              />
            </Field>

            <Field label="Sort order" htmlFor="p-order">
              <input id="p-order" name="sortOrder" className="ac-input" type="number" min={1} defaultValue={1} />
            </Field>

            <div className="adm-file">
              <span className="ac-label">Reference image</span>
              <input name="imageFile" type="file" accept="image/*" required />
              <span className="ac-hint">Images up to 5MB.</span>
            </div>

            <label className="ac-checkbox">
              <input type="checkbox" name="isPublished" defaultChecked />
              Publish straight away
            </label>

            <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="ac-btn ac-btn--quiet" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
                {busy ? 'Saving…' : 'Add prompt'}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
