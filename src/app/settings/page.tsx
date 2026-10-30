import AccountSettings from "@/components/account/AccountSettings";
import TopBar from "@/components/TopBar";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar account="settings" />
      <AccountSettings />
    </div>
  );
}
