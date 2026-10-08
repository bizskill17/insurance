import { useNavigate } from "react-router-dom";
import MasterPage from "./MasterPage";

export default function ClaimFormPage() {
  const navigate = useNavigate();

  return (
    <MasterPage
      resourceKey="claims"
      embeddedFormOnly
      autoOpenForm
      onFormSaved={() => navigate("/claims/pending")}
      onFormCancel={() => navigate("/claims/pending")}
    />
  );
}