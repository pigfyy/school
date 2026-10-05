<!DOCTYPE html> <html lang="">
<head>
    <meta charset="utf-8">

    <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no" />
    <title>CSE 312, Autumn 2026</title>

    
    <!-- TODO: FIX THIS! -->
    <meta name="author" content="Anup Rao, Paul Beame">
    <meta name="description" content="Course website for CSE 312, Foundations of Computing II at the University of Washington">
    <meta name="keywords" content="CSE 312, Foundations of Computing II, discrete mathematics, probability, Anup Rao, Paul Beame, University of Washington, UW, Washington, computer science">

    <base href="https://courses.cs.washington.edu/courses/cse312/26au/">

    <!-- Bootstrap -->

    <link
        rel="stylesheet"
        href="assets/vendors/bootstrap-4.0.0-beta.2.min.css" />

    <!-- Font Awesome -->
    <script src="https://kit.fontawesome.com/ded873da0c.js"></script>

    <!-- Custom CSS -->

    <link
        rel="stylesheet"
        href="assets/styles.css"
        type="text/css" />

</head>
<body>
    <div class="wrapper">
        <div class="container-fluid">
            <div class="title-section">
                <h1>CSE 312: Foundations of Computing II, Autumn 2026</h1>
            </div>

            <div class="row">
                
		<!-- nasty bit to keep sanity -- needs modifying .htaccess to parse .html for php -->
		<nav class="nav-sidebar col">
                    <ul class="row">
                            <li class="nav-section col-4 col-sm-12">
                                <span class="nav-header">Materials</span>
                                <ul>
                                        <li class="">
					  <!-- change me -->
                                            <a href="index.php">
                                                <i class="far fa-calendar-alt fa-fw"></i>Schedule
                                            </a>
                                        </li>
                                        <li class="">
                                            <a href="https://www.gradescope.com/courses/1410735" target="_blank">
                                                <i class="fas fa-check-circle fa-fw"></i>
                                                Gradescope
                                            </a>
                                        </li>
                                        <li class="">
                                            <a href="https://edstem.org/us/courses/107131/discussion" target="_blank">
                                                <i class="fas fa-tasks fa-fw"></i>
                                                Discussion Board
                                            </a>
                                        </li>
                                        <li class="">
                                            <a href="syllabus.php">
                                                <i class="fas fa-scroll fa-fw"></i>
                                                Syllabus
                                            </a>
                                        </li>
                                        <li class="">
                                            <a href="staff.php">
                                                <i class="fas fa-people-carry fa-fw"></i>
                                                Course&nbsp;Staff (Office&nbsp;Hours)
                                            </a>
                                        </li>
                                        <li class="active">
                                            <a href="aipolicy.php">
                                                <i class="fas fa-robot fa-fw"></i>
                                                AI Policy
                                            </a>
                                        </li>
                                        </ul>
                            </li>
                            <li class="nav-section col-4 col-sm-12">
                                <span class="nav-header">Resources</span>
                                <ul>
                                        <li class=""><a href="feedback.php"><i class="far fa-comment-alt fa-fw"></i>Feedback</a></li>
                                        <li class=""><a href="files/Prob_Stat_for_CS_Book.pdf" target="_blank"><i class="fas fa-book fa-fw"></i>Textbook</a></li>
                                        <li class=""><a href="files/distributions.pdf" target="_blank"><i class="fas fa-subscript fa-fw"></i>Distributions</a></li>
                                        <li class=""><a href="files/z_table.pdf" target="_blank"><i class="fas fa-calculator fa-fw"></i>Z Table</a></li>
                                        <li class=""><a href="files/defs_thms.pdf" target="_blank"><i class="fas fa-archive fa-fw"></i>Theorems and Definitions</a></li>
                                        <li class=""><a href="latex.php"><i class="fas fa-laptop-code fa-fw"></i>LaTeX Resources</a></li>
                                </ul>
                            </li>
                    </ul>
 </nav>
                <div class="content col">

<h2>AI Policy</h2>

<p align="center"><img src="files/ai-policy-icon.png" alt="AI for Support and Growth policy icon" style="width: 140px; margin: 10px 0 20px 0;" /></p>

<p><b>AI is not permitted on any graded work in this course.</b> You may use AI for general course questions and ungraded work. Read the full policy carefully before using AI.</p>

<h3>Definition of AI</h3>
<p>For this policy, "AI" refers to generative AI systems that can produce or modify text, code, images, audio, video, or other content - whether in a single response to a prompt or by operating autonomously across multiple steps (e.g., chatbots such as ChatGPT, Claude, and Gemini; code assistants and agents such as GitHub Copilot, Cursor, and Claude Code; and AI-powered writing, translation, and image-generation tools). This includes AI features built into IDEs, operating systems, or browsers when they generate or substantially rewrite content, but excludes non-generative tools such as basic spell-check, grammar/syntax highlighting, and linters. A tool's ability to act autonomously (e.g., independently writing, running, and debugging code) does not exempt it from this definition.</p>

<h3>Rationale</h3>
<p>AI can be valuable for exploring concepts, practicing skills, and developing one's capabilities. However, you are ultimately responsible for your own learning, and the graded work in this course requires you to demonstrate your knowledge and skills without the use of AI.</p>

<h3>Permitted Actions</h3>
<ul>
<li>You may use AI for general questions and support - including concept explanations, study questions, practice problems, ungraded exercises, and exploratory coding that does not involve coding for problem sets - as long as the work is not submitted for credit.</li>
</ul>

<h3>Prohibited Actions</h3>
<ul>
<li>Do not use AI to produce work you submit on any graded assignment.</li>
<li>Do not submit AI-generated work, or lightly edited AI-generated work, as your own.</li>
<li>If an assignment has stricter rules, those rules override this policy for that assignment.</li>
</ul>

<h3>Examples</h3>
<ul>
<li>Allowed: using AI to explain a concept, generate practice questions, or help you study for a quiz.</li>
<li>Allowed: using AI on an ungraded practice exercise or exploratory code that will not be submitted for credit.</li>
<li>Not allowed: using AI to fix a bug or rewrite a proof for you on any graded assignment.</li>
<li>Not allowed: copying work produced by an AI into any graded submission.</li>
</ul>

<h3>Guidelines for Effective AI Use</h3>
<ul>
<li>Remember that AI is not permitted on any graded work in this course.</li>
<li>Use AI to expand your thinking, not to replace it.</li>
<li>Verify AI output carefully; AI can be inaccurate, incomplete, biased, or inconsistent with course expectations.</li>
<li>Maintain control of your work: you should be able to explain and defend every part of what you submit.</li>
<li>When in doubt, err on the side of not using AI and ask the course staff for clarification.</li>
</ul>

<h3>Data Privacy Expectations</h3>
<ul>
<li>Do not upload course-specific materials - including assignment prompts, course code, datasets, class notes, hidden tests, solution keys, or other restricted content - to AI tools without the instructor's explicit approval.</li>
<li>Some AI tools (e.g., Cursor, Claude Code, and similar coding agents) can automatically access files beyond what you explicitly share - including your entire local repository, file system, or connected accounts. Before using such a tool, confirm what it can access and restrict or scope that access so it does not read private repositories, hidden test files, other students' code, solution keys, or other restricted materials without your intent.</li>
<li>Do not submit personal, sensitive, or university-protected information into AI tools.</li>
<li>Be aware that prompts and outputs may be stored or reused by third-party AI providers.</li>
<li>UW's Purple tool and certain GenAI tools provided by the Allen School for use in courses are designed specifically for UW students and staff and have stronger privacy protections than public commercial tools. When AI usage is permitted, using Purple or Allen School-provided tools is advised if possible.</li>
</ul>

<h3>Academic Integrity</h3>
<p>Using AI in ways prohibited by this policy or by assignment-specific instructions will be considered academic misconduct and referred to CSSC. Students found responsible for violating this policy will, at minimum, receive no credit for the affected assignment. Stronger penalties, up to and including failing the course, may apply for repeated or egregious violations. In cases of group work, all students will be held equally responsible for violation unless there is clear evidence that a subset of team members were not involved or aware.</p>

<h3>Accommodations and Approved Exceptions</h3>
<p>Students with accessibility needs or other extenuating circumstances should contact the instructor to discuss exceptions. Accommodations or exceptions require instructor approval before they are used.</p>

</div>
            </div>
       </div>
    </div>
    
    <script src="assets/vendors/jquery-3.1.1.slim.min.js"></script>
    <script src="assets/vendors/bootstrap-4.0.0-beta.2.bundle.min.js"></script>

</body>
</html>
