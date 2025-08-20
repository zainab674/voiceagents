import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to landing page since we now have a proper homepage
    navigate("/");
  }, [navigate]);

  return null;
};

export default Index;
