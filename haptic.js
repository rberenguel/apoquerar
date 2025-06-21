export { haptic };

// Crude JS conversion of https://github.com/tijnjh/ios-haptics
// Thanks for that!

const haptic = () => {
  try {
    const label = document.createElement("label");
    label.ariaHidden = "true";
    label.style.display = "none";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);

    document.body.appendChild(label);
    label.click();
    document.body.removeChild(label);
  } catch {
    console.warn("Could not trigger haptics");
    // Fail silently
  }
};

haptic.confirm = () => {
  haptic();
  setTimeout(() => haptic(), 120);
};

haptic.error = () => {
  haptic();
  setTimeout(() => haptic(), 120);
  setTimeout(() => haptic(), 240);
};
