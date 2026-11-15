import { requireMentor } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { ActionForm } from "@/components/ActionForm";
import { updateProfile } from "@/app/actions/mentor";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { mentor } = await requireMentor();
  const [categories, mine] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.mentorProfile.findUniqueOrThrow({ where: { id: mentor.id }, select: { categories: { select: { id: true } } } }),
  ]);
  const selected = new Set(mine.categories.map((c) => c.id));
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Profile</h1>
      <ActionForm action={updateProfile} className="card space-y-5 p-6">
        <div>
          <label className="label" htmlFor="headline">Headline</label>
          <input id="headline" name="headline" defaultValue={mentor.headline} maxLength={140} className="input" placeholder="Ex-Google PM. I help career switchers land their first PM role." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="company">Role / company</label>
            <input id="company" name="company" defaultValue={mentor.company} className="input" placeholder="Senior PM at Stripe" />
          </div>
          <div>
            <label className="label" htmlFor="slug">Profile URL</label>
            <div className="flex items-center rounded-lg border border-line bg-surface pl-3 text-sm text-muted focus-within:border-accent">
              <span className="whitespace-nowrap">{appUrl().replace(/^https?:\/\//, "")}/m/</span>
              <input id="slug" name="slug" defaultValue={mentor.slug} className="w-full bg-transparent py-2 pr-3 text-foreground outline-none" />
            </div>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bio">About you</label>
          <textarea id="bio" name="bio" rows={6} defaultValue={mentor.bio} maxLength={3000} className="input" placeholder="Your background, who you can help most, and what a great call with you looks like." />
        </div>
        <fieldset>
          <legend className="label">Niche (up to 3)</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <label key={c.id} className="chip cursor-pointer gap-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={selected.has(c.id)} className="sr-only" />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="avatarUrl">Photo URL</label>
            <input id="avatarUrl" name="avatarUrl" defaultValue={mentor.avatarUrl} className="input" placeholder="https://…" />
          </div>
          <div>
            <label className="label" htmlFor="linkedinUrl">LinkedIn URL</label>
            <input id="linkedinUrl" name="linkedinUrl" defaultValue={mentor.linkedinUrl} className="input" placeholder="https://linkedin.com/in/…" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="timezone">Your timezone</label>
          <select id="timezone" name="timezone" defaultValue={mentor.timezone} className="input">
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Your availability is set in this timezone. Mentees see times in their own.</p>
        </div>
      </ActionForm>
    </div>
  );
}
