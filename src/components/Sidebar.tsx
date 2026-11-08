import { FOLDERS, SECTIONS } from "../domain/folders";
import { emailInView } from "../domain/organise";
import type { SidebarFolder, StoredEmail } from "../domain/types";

interface SidebarProps {
  emails: StoredEmail[];
  view: SidebarFolder;
  onView: (view: SidebarFolder) => void;
  onSettings: () => void;
  onImport: () => void;
  onRules: () => void;
  onRestore: () => void;
}

export function Sidebar({ emails, view, onView, onSettings, onImport, onRules, onRestore }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <p className="brand-kicker">RS Digital Services</p>
        <h1>Post Room</h1>
      </div>
      <nav className="folders" aria-label="Folders">
        {SECTIONS.map((section) => (
          <div key={section} className="folder-section">
            <p className="section-label">{section}</p>
            {FOLDERS.filter((folder) => folder.section === section).map((folder) => {
              const count = emails.filter((email) => emailInView(email, folder.id)).length;
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={folder.id === view ? "folder active" : "folder"}
                  aria-current={folder.id === view ? "page" : undefined}
                  onClick={() => onView(folder.id)}
                >
                  <span>{folder.label}</span>
                  <span className="count">{count}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-actions">
        <button type="button" onClick={onImport}>
          Add mail
        </button>
        <button type="button" onClick={onSettings}>
          Settings
        </button>
        <button type="button" onClick={onRules}>
          How filing works
        </button>
        <button type="button" onClick={onRestore}>
          Restore sample mailbox
        </button>
      </div>
    </aside>
  );
}
