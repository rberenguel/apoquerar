export { haptic };

// Crude JS conversion of https://github.com/tijnjh/ios-haptics
// Thanks for that!

let started = false;

const haptic = () => {
  try {
    if (started) {
      return;
    }
    started = true;
    const label = document.createElement("label");
    label.ariaHidden = "true";
    label.style.display = "none";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);

    document.head.appendChild(label);
    label.click();
    document.head.removeChild(label);
    started = false;
  } catch {
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
