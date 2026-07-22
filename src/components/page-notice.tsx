export function PageNotice({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;

  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-6 rounded-xl px-4 py-3 text-sm ${
        error ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
      }`}
    >
      {error ?? success}
    </p>
  );
}
