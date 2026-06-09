import { MrtDashboard } from "@/components/mrms/MrtDashboard";
import { getServerSideMrt, getServerSideUser } from "@/lib/server/auth";


export default async function MrtPage() {
  const [user, mrt] = await Promise.all([
    getServerSideUser(),
    getServerSideMrt(),
  ]);

  if (mrt.personas.length === 0) {
    return (
      <div className="px-14 py-14 max-w-[680px]">
        <h1 className="font-display font-light text-[64px] leading-[0.95] text-[var(--mrms-ink)] mb-6">
          <em className="font-display italic text-[var(--mrms-rust)]">No data</em>
          <br />yet.
        </h1>
        <p className="font-mono text-[12px] text-[var(--mrms-ink-soft)] leading-relaxed mb-4">
          MRT data needs to be generated. Run the script:
        </p>
        <pre className="bg-[var(--mrms-ink)] text-[var(--mrms-paper)] p-4 font-mono text-[12px] leading-relaxed">
{`python3 scripts/09_generate_mrt.py --email ${user.email}`}
        </pre>
      </div>
    );
  }

  return <MrtDashboard user={user} mrt={mrt} />;
}
