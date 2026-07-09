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
    renderPages();
  } catch (error) {
    toast("Error during scanning: " + error.message, "error");
  }
}

function checkAndRunScan(scanType) {
  const form = document.getElementById("pdfForm");
  const formData = new FormData(form);
  const entries = Object.fromEntries(formData.entries());

  const lastScanStr = localStorage.getItem("lastFastScanTime");
  if (lastScanStr) {
    const lastScanTime = parseInt(lastScanStr, 10);
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - lastScanTime > oneHour) {
      const dialog = document.getElementById("confirmModal");
      const confirmBtn = document.getElementById("confirmScanBtn");
      const cancelBtn = document.getElementById("cancelScanBtn");

      let confirmed = false;

      const handleConfirm = () => {
        confirmed = true;
        dialog.close();
      };

      const handleCancel = () => {
        dialog.close();
      };

      const handleClose = () => {
        confirmBtn.removeEventListener("click", handleConfirm);
        cancelBtn.removeEventListener("click", handleCancel);
        dialog.removeEventListener("close", handleClose);

        if (confirmed) {
          handleSubmit(entries, scanType);
        }
      };

      confirmBtn.addEventListener("click", handleConfirm);
      cancelBtn.addEventListener("click", handleCancel);
      dialog.addEventListener("close", handleClose);

      dialog.showModal();
      return;
    }
  }
  handleSubmit(entries, scanType);
}

document.getElementById("pdfForm").addEventListener("submit", function (e) {
  e.preventDefault();
  checkAndRunScan("color");
});

function handleClickAddButton(scanType) {
  checkAndRunScan(scanType);
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

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const pdfUrl = await res.text();
    tempFileNames = [];
    console.log("PDF created at:", pdfUrl);
    localStorage.setItem("lastFastScanTime", Date.now().toString());
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

async function renderPages() {
  pageList.innerHTML = "";
  for (let i = 0; i < tempFileNames.length; i++) {
    const div = document.createElement("div");
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "X";
    deleteButton.addEventListener("click", () => {
      tempFileNames.splice(i, 1);
      renderPages();
    });
    div.appendChild(deleteButton);
    div.className = "page";
    const img = document.createElement("img");
    const res = await fetch(`/image/${tempFileNames[i]}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    img.src = url;
    div.appendChild(img);
    pageList.appendChild(div);
  }
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
