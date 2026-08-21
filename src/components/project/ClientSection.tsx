import { useEffect, useState } from "react";
import { getClient, saveClient } from "../../db/clientsRepo";
import { userErrorMessage } from "../../lib/errors";

/** Who this project bills to — the invoice "bill to" block. One client per
 *  project, so it's pre-filled each month rather than retyped. */
export function ClientSection({ projectId }: { projectId: string }) {
  const [name, setName] = useState("");
  const [addressLines, setAddressLines] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void getClient(projectId).then((client) => {
      if (cancelled) return;
      setName(client?.name ?? "");
      setAddressLines(client?.addressLines ?? "");
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const commit = async () => {
    setError(null);
    if (!loaded) return;
    try {
      await saveClient({ projectId, name: name.trim(), addressLines });
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't save the client. Please try again."));
    }
  };

  return (
    <section className="settings-section">
      <h3>Client</h3>
      <p className="settings-hint">Billed on this project’s invoices.</p>
      <div className="form-row">
        <label htmlFor="client-name">Name</label>
        <input
          id="client-name"
          value={name}
          disabled={!loaded}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void commit()}
        />
      </div>
      <div className="form-row">
        <label htmlFor="client-address">Address</label>
        <textarea
          id="client-address"
          rows={4}
          value={addressLines}
          disabled={!loaded}
          onChange={(e) => setAddressLines(e.target.value)}
          onBlur={() => void commit()}
        />
      </div>
      {error && <div className="form-error">{error}</div>}
    </section>
  );
}
