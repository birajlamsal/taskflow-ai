import SettingsLayout from "../../components/settings/SettingsLayout";

export default function SettingsLayoutPage({
  children
}: {
  children: React.ReactNode;
}) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
