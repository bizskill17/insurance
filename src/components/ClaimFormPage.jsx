import { useNavigate } from "react-router-dom";
import MasterPage from "./MasterPage";

export default function ClaimFormPage({ currentUser }) {
  const navigate = useNavigate();

  return (
    <MasterPage
      resourceKey="claims"
      permissionPath="/claims/form"
      currentUser={currentUser}
      embeddedFormOnly
      autoOpenForm
      onFormSaved={() => navigate("/claims/pending")}
      onFormCancel={() => navigate("/claims/pending")}
    />
  );
}
