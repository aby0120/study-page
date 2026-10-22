(() => {
  "use strict";

  const data = window.QUIZ_DATA;
  const material = window.QUIZ_RESULT_MATERIAL || { note: "", profiles: [] };
  const materialById = Object.fromEntries(material.profiles.map((profile) => [profile.id, profile]));
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
    const evidenceByProfile = {};
    data.results.forEach((profile) => {
      scores[profile.id] = 0;
      evidenceByProfile[profile.id] = [];
    });
    const mostRecentMatches = [];
    answers.forEach((choiceIndex, index) => {
      const choice = data.questions[index].choices[choiceIndex];
      const matchedIds = new Set(choice.tags.map((tag) => data.aliases[tag]).filter(Boolean));
      matchedIds.forEach((id) => {
        if (!id || !Object.prototype.hasOwnProperty.call(scores, id)) return;
        scores[id] += 1;
        mostRecentMatches.push(id);
        evidenceByProfile[id].push({
          question: data.questions[index].title,
          choiceTitle: choice.title,
          text: choice.text
        });
      });
    });
    return { scores, mostRecentMatches, evidenceByProfile };
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

  function selectedAnswerEvidence(questionIndex, choiceIndex) {
    const question = data.questions[questionIndex];
    const choice = question.choices[choiceIndex];
    return { question: question.title, choiceTitle: choice.title, text: choice.text };
  }

  function getResultEvidence(profileId, evidenceByProfile, alternatives) {
    if (profileId === "gap_year") {
      const pauseSignals = [[0, 3], [4, 3], [5, 2], [7, 2]];
      return pauseSignals
        .filter(([questionIndex, choiceIndex]) => answers[questionIndex] === choiceIndex)
        .map(([questionIndex, choiceIndex]) => selectedAnswerEvidence(questionIndex, choiceIndex));
    }
    if (profileId === "flexible") {
      const alternativeIds = new Set(alternatives.map((profile) => profile.id));
      const seenQuestions = new Set();
      return Array.from(alternativeIds)
        .flatMap((id) => evidenceByProfile[id] || [])
        .filter((item) => {
          if (seenQuestions.has(item.question)) return false;
          seenQuestions.add(item.question);
          return true;
        })
        .slice(0, 4);
    }
    return evidenceByProfile[profileId] || [];
  }

  function addEvidenceItems(host, items) {
    host.replaceChildren();
    items.forEach((item) => {
      const li = document.createElement("li");
      const question = document.createElement("span");
      question.className = "evidence-question";
      question.textContent = item.question;
      const choice = document.createElement("strong");
      choice.textContent = item.choiceTitle;
      const text = document.createElement("p");
      text.textContent = item.text;
      li.append(question, choice, text);
      host.append(li);
    });
  }

  function setText(id, value) {
    document.getElementById(id).textContent = value || "";
  }

  function showResult() {
    const { scores, mostRecentMatches, evidenceByProfile } = tallyAnswers();
    const winner = chooseProfile(scores, mostRecentMatches);
    const alternatives = data.results
      .filter((profile) => !["flexible", "gap_year"].includes(profile.id) && profile.id !== winner.id && scores[profile.id] > 0)
      .sort((a, b) => scores[b.id] - scores[a.id])
      .slice(0, 3);
    const source = materialById[winner.id] || {};
    const evidence = getResultEvidence(winner.id, evidenceByProfile, alternatives);

    setText("result-label", winner.label);
    setText("result-title", winner.title);
    setText("result-source-title", source.sourceTitle ? "原素材趣味画像：" + source.sourceTitle : "");
    setText("result-quote", source.quote || winner.quote);
    setText("result-summary", winner.summary);
    setText("result-why-fit", source.whyFit || winner.summary);
    setText("result-need", source.need || winner.summary);
    if (winner.id === "gap_year") {
      setText("result-match-count", "有 " + evidence.length + " 个回答信号，提示你可以先理清节奏，再决定目的地。");
    } else if (winner.id === "flexible") {
      setText("result-match-count", "你的线索分布在多个方向，没有单一目的地明显领先。");
    } else {
      setText("result-match-count", "本次有 " + scores[winner.id] + " 道选择与这个画像的线索相呼应。");
    }
    addEvidenceItems(document.getElementById("result-evidence-list"), evidence);
    document.getElementById("result-evidence-block").hidden = evidence.length === 0;
    addListItems(document.getElementById("result-strengths"), winner.strengths);
    addListItems(document.getElementById("result-checks"), winner.checks);

    setText("source-category", source.category);
    setText("source-category-share", source.categoryShare);
    setText("source-share", source.share);
    setText("source-title", source.sourceTitle);
    setText("source-quote", source.quote);
    setText("source-judgment", source.judgment);
    setText("source-need", source.need);
    setText("source-note", material.note);

    const pills = document.getElementById("destination-pills");
    pills.replaceChildren();
    alternatives.forEach((profile) => {
      const card = document.createElement("article");
      card.className = "destination-pill";
      const title = document.createElement("strong");
      title.textContent = profile.title;
      const match = document.createElement("span");
      match.className = "destination-match";
      match.textContent = "匹配 " + scores[profile.id] + " 道回答线索";
      const summary = document.createElement("p");
      summary.textContent = profile.summary;
      card.append(title, match, summary);
      pills.append(card);
    });
    const alternativesBlock = document.getElementById("alternatives-block");
    alternativesBlock.hidden = alternatives.length === 0;
    const altHeading = alternativesBlock.querySelector(".eyebrow");
    altHeading.textContent = winner.id === "gap_year" ? "可以继续比较" : "同频备选";
    const altNote = alternativesBlock.querySelector(".alternatives-note");
    altNote.textContent = winner.id === "gap_year"
      ? "先理清节奏之后，可以从这些目的地继续了解"
      : "其他回答里也出现的目的地线索";

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
    const whyFit = document.getElementById("result-why-fit").textContent;
    const need = document.getElementById("result-need").textContent;
    const evidence = Array.from(document.querySelectorAll("#result-evidence-list li"))
      .map((li) => Array.from(li.children).map((child) => child.textContent).join("："))
      .join("\n");
    const message = [
      title,
      quote,
      summary,
      "为什么可能适合：" + whyFit,
      evidence ? "你的作答线索：\n" + evidence : "",
      "这类环境回应的需要：" + need
    ].filter(Boolean).join("\n\n");
    const status = document.getElementById("copy-status");
    try {
      await navigator.clipboard.writeText(message);
      status.textContent = "完整结果摘要已复制";
    } catch {
      status.textContent = "暂时无法复制，可以手动选中结果文字";
    }
    window.setTimeout(() => { status.textContent = ""; }, 2800);
  });
})();
