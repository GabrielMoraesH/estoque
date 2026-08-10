import FeedbackState from "./FeedbackState";
import Panel from "./ui/Panel";

function FeedbackPanel(props) {
  return (
    <Panel>
      <FeedbackState {...props} />
    </Panel>
  );
}

export default FeedbackPanel;
