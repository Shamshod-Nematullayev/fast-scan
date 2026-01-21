let tempFileNames = []; // to store temp file names

async function handleSubmit(data, scanType) {
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
    toast("Error during scanning: " + error.message, "error");
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
    tempFileNames = [];
    console.log("PDF created at:", pdfUrl);
  } catch (error) {
    toast("Error during PDF creation: " + error.message, "error");
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
      toast("Last page removed.");
    } else {
      toast("No pages to remove.", "error");
    }
  });

document.getElementById("clearAllPages").addEventListener("click", function () {
  tempFileNames = [];
  toast("All pages cleared.");
});

function toDisableButtons(disabled) {
  if (disabled) {
    showLoading();
  } else {
    hideLoading();
  }
  const formElements = document.getElementById("pdfForm").elements;
  for (let i = 0; i < formElements.length; i++) {
    formElements[i].disabled = disabled;
  }
}

const pageList = document.getElementById("pageList");
let pages = [1, 2, 3]; // Example initial pages

function addPage(type) {
  pages.push(type);
  renderPages();
  toast(`${type} page added`);
}

function renderPages() {
  pageList.innerHTML = "";
  pages.forEach((p, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${p}`;
    pageList.appendChild(li);
  });
}

function showLoading() {
  document.getElementById("loading").classList.remove("hidden");
}
function hideLoading() {
  document.getElementById("loading").classList.add("hidden");
}

function toast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;

  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
