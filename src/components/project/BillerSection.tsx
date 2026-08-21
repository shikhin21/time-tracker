import { useEffect, useState } from "react";
import type { BillerDetails } from "../../db/db";
import { getBillerDetails, saveBillerDetails } from "../../db/clientsRepo";
import { userErrorMessage } from "../../lib/errors";

const EMPTY: BillerDetails = { name: "", addressLines: "", phone: "" };

/** The invoice "from" block — app-level, so it's set once and pre-filled onto
 *  every invoice regardless of project. */
export function BillerSection() {
  const [details, setDetails] = useState<BillerDetails>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getBillerDetails().then((d) => {
      if (!cancelled) {
        setDetails(d);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = async (next: BillerDetails) => {
    setError(null);
    try {
      await saveBillerDetails(next);
    } catch (e) {
      setError(userErrorMessage(e, "Couldn't save your details. Please try again."));
    }
  };

  const field = (key: keyof BillerDetails) => ({
    value: details[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDetails({ ...details, [key]: e.target.value }),
    onBlur: () => void commit(details),
    disabled: !loaded,
  });

  return (
    <section className="settings-section">
      <h3>Your details</h3>
      <p className="settings-hint">
        Printed as the “from” block on every invoice, for all projects.
      </p>
      <div className="form-row">
        <label htmlFor="biller-name">Name</label>
        <input id="biller-name" {...field("name")} />
      </div>
      <div className="form-row">
        <label htmlFor="biller-address">Address</label>
        <textarea id="biller-address" rows={4} {...field("addressLines")} />
      </div>
      <div className="form-row">
        <label htmlFor="biller-phone">Phone</label>
        <input id="biller-phone" {...field("phone")} />
      </div>
      {error && <div className="form-error">{error}</div>}
    </section>
  );
}
