let tempFileNames = []; // to store temp file names

async function handleSubmit(data, scanType) {
  //   need to show values in alert
  console.log("Form Data Submitted:", data);

  try {
    toDisableButtons(true);
    const res = await fetch("/scanFromCanon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dpi: data.dpi,
        mode: scanType,
      }),
    });

    const tempFileName = await res.text();
    tempFileNames.push(tempFileName);
    toDisableButtons(false);
  } catch (error) {
    alert("Error during scanning: " + error.message);
  }
}

document.getElementById("pdfForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const entries = Object.fromEntries(formData.entries());

  handleSubmit(entries, "color");
});

function handleClickAddButton(scanType) {
  const form = document.getElementById("pdfForm");
  const formData = new FormData(form);
  const entries = Object.fromEntries(formData.entries());

  handleSubmit(entries, scanType);
}

document
  .getElementById("addBlackWhitePage")
  .addEventListener("click", function () {
    handleClickAddButton("bw");
  });

document
  .getElementById("addGrayScalePage")
  .addEventListener("click", function () {
    handleClickAddButton("gray");
  });

document.getElementById("addColorPage").addEventListener("click", function () {
  handleClickAddButton("color");
});

// ShourtCuts
window.addEventListener("keydown", function (event) {
  // 1. Check if the user is typing in a form field
  const isTyping =
    document.activeElement.tagName === "INPUT" ||
    document.activeElement.tagName === "TEXTAREA" ||
    document.activeElement.isContentEditable;

  // 2. If they are typing, don't run our shortcut logic
  if (isTyping) return;

  // 3. Define your shortcuts
  switch (event.key) {
    case "1":
      handleClickAddButton("bw");
      break;
    case "2":
      handleClickAddButton("gray");
      break;
    case "3":
      handleClickAddButton("color");
      break;
    case "s":
      savePdfButtonHandler();
      break;
    case "0":
      savePdfButtonHandler();
      break;
    // Add more keys as needed
  }
});

const savePdfButtonHandler = async () => {
  const outputFileName = prompt(
    "Enter output PDF file name:",
    "scanned_document"
  );

  try {
    const res = await fetch("/createPdfByImgs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imgFileNames: tempFileNames,
        outputFileName: outputFileName,
      }),
    });

    const pdfUrl = await res.text();
    console.log("PDF created at:", pdfUrl);
  } catch (error) {
    alert("Error during PDF creation: " + error.message);
  }
};

document
  .getElementById("savePdfButton")
  .addEventListener("click", async function () {
    savePdfButtonHandler();
  });

document
  .getElementById("removeLastPage")
  .addEventListener("click", function () {
    if (tempFileNames.length > 0) {
      tempFileNames.pop();
      alert("Last page removed.");
    } else {
      alert("No pages to remove.");
    }
  });

document.getElementById("clearAllPages").addEventListener("click", function () {
  tempFileNames = [];
  alert("All pages cleared.");
});

function toDisableButtons(disabled) {
  const formElements = document.getElementById("pdfForm").elements;
  for (let i = 0; i < formElements.length; i++) {
    formElements[i].disabled = disabled;
  }
}
