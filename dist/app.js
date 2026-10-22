(() => {
  "use strict";

  const data = window.QUIZ_DATA;
  const intro = document.getElementById("intro");
  const quiz = document.getElementById("quiz");
  const resultSection = document.getElementById("result");
  const choicesHost = document.getElementById("choices");
  const startButton = document.getElementById("start-button");
  const exitButton = document.getElementById("exit-button");
  const backButton = document.getElementById("back-button");
  const nextButton = document.getElementById("next-button");
  const progressFill = document.getElementById("progress-fill");
  const progressTrack = document.getElementById("progress-track");
  const answers = new Array(data.questions.length).fill(null);
  let questionIndex = 0;

  function showSection(section) {
    intro.hidden = section !== "intro";
    quiz.hidden = section !== "quiz";
    resultSection.hidden = section !== "result";
    const method = document.getElementById("method");
    method.hidden = section === "result";
    if (section === "quiz") {
      window.setTimeout(() => quiz.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderQuestion() {
    const question = data.questions[questionIndex];
    document.getElementById("question-counter").textContent = "第 " + (questionIndex + 1) + " / " + data.questions.length + " 题";
    document.getElementById("question-index").textContent = String(questionIndex + 1).padStart(2, "0");
    document.getElementById("question-title").textContent = question.title;
    document.getElementById("question-scene").textContent = question.scene;
    document.getElementById("question-prompt").textContent = question.prompt;
    choicesHost.replaceChildren();

    question.choices.forEach((choice, choiceIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.setAttribute("aria-pressed", String(answers[questionIndex] === choiceIndex));
      if (answers[questionIndex] === choiceIndex) button.classList.add("selected");

      const letter = document.createElement("span");
      letter.className = "choice-letter";
      letter.textContent = String.fromCharCode(65 + choiceIndex);
      letter.setAttribute("aria-hidden", "true");

      const copy = document.createElement("span");
      copy.className = "choice-copy";
      const title = document.createElement("span");
      title.className = "choice-title";
      title.textContent = choice.title;
      const body = document.createElement("span");
      body.className = "choice-text";
      body.textContent = choice.text;
      copy.append(title, body);
      button.append(letter, copy);
      button.addEventListener("click", () => {
        answers[questionIndex] = choiceIndex;
        renderQuestion();
        nextButton.focus({ preventScroll: true });
      });
      choicesHost.append(button);
    });

    backButton.disabled = questionIndex === 0;
    nextButton.disabled = answers[questionIndex] === null;
    nextButton.innerHTML = questionIndex === data.questions.length - 1
      ? "看看我的结果 <span aria-hidden=\"true\">→</span>"
      : "选好了，继续 <span aria-hidden=\"true\">→</span>";
    const progress = Math.round(((questionIndex + (answers[questionIndex] === null ? 0 : 1)) / data.questions.length) * 100);
    progressFill.style.width = progress + "%";
    progressTrack.setAttribute("aria-valuenow", String(Math.round((progress / 100) * data.questions.length)));
  }

  function tallyAnswers() {
    const scores = {};
    data.results.forEach((profile) => { scores[profile.id] = 0; });
    const mostRecentMatches = [];
    answers.forEach((choiceIndex, index) => {
      const choice = data.questions[index].choices[choiceIndex];
      const matchedIds = new Set(choice.tags.map((tag) => data.aliases[tag]).filter(Boolean));
      matchedIds.forEach((id) => {
        if (!id || !Object.prototype.hasOwnProperty.call(scores, id)) return;
        scores[id] += 1;
        mostRecentMatches.push(id);
      });
    });
    return { scores, mostRecentMatches };
  }

  function chooseProfile(scores, mostRecentMatches) {
    const regularProfiles = data.results.filter((profile) => !["flexible", "gap_year"].includes(profile.id));
    const maxScore = Math.max(...regularProfiles.map((profile) => scores[profile.id]));
    const moderatelyMatched = regularProfiles.filter((profile) => scores[profile.id] >= 2).length;
    const variedAnswers = new Set(answers).size >= 3;

    // 反复选择暂停、休息或重新消化信息时，让“申请节奏”成为更值得先讨论的路径。
    const pauseSignals = [
      answers[0] === 3,
      answers[4] === 3,
      answers[5] === 2,
      answers[7] === 2
    ].filter(Boolean).length;
    if (pauseSignals >= 3 && maxScore <= 4) {
      return data.results.find((profile) => profile.id === "gap_year");
    }

    // 多个目的地线索接近时，显示隐藏的“自带地图”结果，并列出得分靠前的备选。
    if (maxScore <= 2 && moderatelyMatched >= 8 && variedAnswers) {
      return data.results.find((profile) => profile.id === "flexible");
    }

    const tied = regularProfiles.filter((profile) => scores[profile.id] === maxScore);
    for (let index = mostRecentMatches.length - 1; index >= 0; index -= 1) {
      const recent = tied.find((profile) => profile.id === mostRecentMatches[index]);
      if (recent) return recent;
    }
    return tied[0];
  }

  function addListItems(host, items) {
    host.replaceChildren();
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      host.append(li);
    });
  }

  function showResult() {
    const { scores, mostRecentMatches } = tallyAnswers();
    const winner = chooseProfile(scores, mostRecentMatches);
    const alternatives = data.results
      .filter((profile) => !["flexible", "gap_year"].includes(profile.id) && profile.id !== winner.id && scores[profile.id] > 0)
      .sort((a, b) => scores[b.id] - scores[a.id])
      .slice(0, 3);

    document.getElementById("result-label").textContent = winner.label;
    document.getElementById("result-title").textContent = winner.title;
    document.getElementById("result-quote").textContent = winner.quote;
    document.getElementById("result-summary").textContent = winner.summary;
    addListItems(document.getElementById("result-strengths"), winner.strengths);
    addListItems(document.getElementById("result-checks"), winner.checks);

    const pills = document.getElementById("destination-pills");
    pills.replaceChildren();
    alternatives.forEach((profile) => {
      const pill = document.createElement("span");
      pill.className = "destination-pill";
      pill.textContent = profile.places.join(" / ");
      pills.append(pill);
    });
    const alternativesBlock = document.getElementById("alternatives-block");
    alternativesBlock.hidden = alternatives.length === 0;
    const altHeading = alternativesBlock.querySelector(".eyebrow");
    altHeading.textContent = winner.id === "gap_year" ? "可以继续比较" : "同频备选";
    const altNote = alternativesBlock.querySelector(".alternatives-note");
    altNote.textContent = winner.id === "gap_year"
      ? "先理清节奏之后，可以从这些目的地继续了解"
      : "来自你答案里的其他目的地线索";

    showSection("result");
  }

  startButton.addEventListener("click", () => {
    questionIndex = 0;
    renderQuestion();
    showSection("quiz");
  });
  exitButton.addEventListener("click", () => showSection("intro"));
  backButton.addEventListener("click", () => {
    if (questionIndex > 0) {
      questionIndex -= 1;
      renderQuestion();
      document.getElementById("question-title").focus({ preventScroll: true });
    } else {
      showSection("intro");
    }
  });
  nextButton.addEventListener("click", () => {
    if (answers[questionIndex] === null) return;
    if (questionIndex === data.questions.length - 1) {
      showResult();
      return;
    }
    questionIndex += 1;
    renderQuestion();
    document.getElementById("question-title").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("edit-answers-button").addEventListener("click", () => {
    questionIndex = data.questions.length - 1;
    renderQuestion();
    showSection("quiz");
  });
  document.getElementById("restart-button").addEventListener("click", () => {
    answers.fill(null);
    questionIndex = 0;
    renderQuestion();
    showSection("intro");
  });
  document.getElementById("copy-button").addEventListener("click", async () => {
    const title = document.getElementById("result-title").textContent;
    const quote = document.getElementById("result-quote").textContent;
    const summary = document.getElementById("result-summary").textContent;
    const message = title + "\n" + quote + "\n" + summary;
    const status = document.getElementById("copy-status");
    try {
      await navigator.clipboard.writeText(message);
      status.textContent = "结果摘要已复制";
    } catch {
      status.textContent = "暂时无法复制，可以手动选中结果文字";
    }
    window.setTimeout(() => { status.textContent = ""; }, 2800);
  });
})();
