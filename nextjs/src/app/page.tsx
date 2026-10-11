import RuntimeBootstrap from "~/components/RuntimeBootstrap";
import FlightWorkspace from "~/views/index";

export default function Page() {
  return (
    <>
      <FlightWorkspace />
      <RuntimeBootstrap page="index" />
    </>
  );
}
