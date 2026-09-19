import Link from "next/link";
import { createJob } from "@/app/actions/jobs";

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/" className="text-sm font-medium text-teal-dark">
          ← Job board
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">New job</h1>
        <p className="text-sm text-stone-600">
          Leave the price blank. You add that on the quote screen.
        </p>
      </div>
      <form
        action={createJob}
        encType="multipart/form-data"
        className="space-y-3 rounded-2xl border border-line bg-card p-4"
      >
        <Field name="customerName" label="Customer name" required />
        <Field name="customerEmail" label="Email" type="email" />
        <Field name="customerPhone" label="Phone" />
        <Field name="vehicle" label="Vehicle" placeholder="Honda CR-V — rear quarter" />
        <Field name="suburb" label="Suburb" placeholder="Glenelg" />
        <Field name="address" label="Address" />
        <label className="block text-sm font-medium text-ink">
          Channel
          <select
            name="channel"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
            defaultValue="email"
          >
            <option value="email">Email</option>
            <option value="website">Website form</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-ink">
          Damage notes
          <textarea
            name="damageNotes"
            rows={4}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Repair items (one per line)
          <textarea
            name="repairItems"
            rows={3}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
            placeholder="Front bumper scratch"
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Repair photos
          <input
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="mt-1 block w-full text-sm"
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">
            Optional. Add the damage shots so you know the panel before you
            drive out.
          </span>
        </label>
        <button
          type="submit"
          className="w-full min-h-11 rounded-full bg-teal py-3 text-sm font-semibold text-ink"
        >
          Save job
        </button>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
      />
    </label>
  );
}
