<!DOCTYPE html>
<html lang="">
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

    <link rel="stylesheet" href="assets/styles.css" type="text/css" />

</head>

<body>

<div class="wrapper">

<div class="container-fluid">

<div class="title-section"> <h1>CSE 312: Foundations of Computing II, Autumn 2026</h1> </div>

	    <div class="row">
	      <!-- nasty bit to keep sanity -- needs modifying
	      .htaccess to parse .html for php --> <nav class="nav-sidebar col">
                    <ul class="row">
                            <li class="nav-section col-4 col-sm-12">
                                <span class="nav-header">Materials</span>
                                <ul>
                                        <li class="active">
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
                                        <li class="">
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
	      <h2>Course Staff/Office Hours</h2>

<p>In addition to the staff contact information, this page contains the most up-to-date listing of staff office hours (and their location), also given as a calendar. Office hours <b>are
    subject to change</b>, but we'll try to keep this page accurate at least a week into the future.</p>


<iframe src="https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=America%2FLos_Angeles&bgcolor=%23ffffff&showPrint=0&showCalendars=0&showTitle=0&mode=WEEK&src=c_1db9809748bfb7141cca3cfb2877237b77535c4beda69f281177ad272ecba9d3%40group.calendar.google.com&color=%23F09300" style="border-width:0" width="100%" height="600" frameborder="0" scrolling="no"></iframe>





<div class="course-staff">
<hr />

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/AnupRao.jpg" />
            </div>
            <ul class="info col">
                <li class="name"><a href="https://homes.cs.washington.edu/~anuprao/" target="_blank">Anup Rao (Instructor)</a></li>
                <li>anuprao [at] cs.washington.edu</li>
                <li><i>Office: CSE 656</i></li>
                <!-- TODO: office hours - not finalized -->
                <li>My research is broadly in theoretical computer science. I love thinking about clean mathematical questions that are relevant to computer science. Most of my research papers involve advanced applications of the topics that are taught in this class! I have a youtube channel where I post videos about topics in math, computer science and finance that I find interesting: <a href="https://www.youtube.com/channel/UCbVGFH5BbNixiAdgZ42ERyQ">https://www.youtube.com/channel/UCbVGFH5BbNixiAdgZ42ERyQ</a>. Like and subscribe!</li>
            </ul>

</div>

        <div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/PaulBeame.jpg" />
            </div>
            <ul class="info col">
                <li class="name"><a href="https://homes.cs.washington.edu/~beame/site/" target="_blank">Paul Beame (Instructor)</a></li>
                <li>beame [at] cs.washington.edu</li>
                <li><i>Office: CSE 668</i></li>
                <!-- TODO: office hours -->
                <li>Welcome to CSE 312!   I've been here long enough to have worked with the design teams for both the Gates and Allen Centers. My primary research is in computational complexity, with interests both in pure theory and in its applications to other areas of CS. Randomness comes up in my research both as an algorithmic technique to solve problems and as a way of constructing challenging examples to show that problems are hard solve.</li>
            </ul>

        </div>
<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/AdinAberbach.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Adin Aberbach (he/him)</li>
                <li>aberbach [at] cs.washington.edu</li>
                <!-- TODO: section -->
                <!-- TODO: office hours -->
                <li>Hi all! My name is Adin, and I'm a first year PhD student studying complexity theory. Outside of school I love to paint, look at art, play/watch sports (Ultimate Frisbee, Spikeball, basketball, etc.), eat good food, read, and be in nature. I'm excited to meet y'all and please reach out if you have any questions!</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/BetaChen.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Beta Chen</li>
                <li>bchen35 [at] uw.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <li>Hello! I’m a fourth year computer science and math major interested in pursuing the academia route. In my spare time I like to cook, play piano, and play board games as well as other strategy games. I like interesting math puzzles as well. Feel free to ask about or share any!</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/DarinErshov.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Darin Ershov</li>
                <li>dkershov [at] uw.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <!-- TODO: office hours -->
                <li>Hi, I'm Darin. I'm a junior majoring in Computer Science and Mathematics. I really love math and my research interests are in theoretical computer science, more specifically I'm working with the quantum group. Outside of classes, I like playing board games and grand strategy video games. Excited to meet you guys!</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/ArnavMazumder.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Arnav Mazumder</li>
                <li>am2107 [at] cs.washington.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <!-- TODO: office hours -->
                <li>Hi, I'm Arnav! I am a CSE Master's student and this is my 2nd quarter TA-ing for 312. My current research interests are in causal inference and multilingual LMs. In my free time, I enjoy tennis, playing music, and hiking.</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/MedhaMittal.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Medha Mittal</li>
                <li>mmittal2 [at] cs.washington.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <!-- TODO: office hours -->
                <li>Hi everyone! My name is Medha and I'm a junior majoring in computer science. This is my fifth quarter as a TA, and my second quarter in 312. I'm excited to meet you all! In my free time, I love traveling, playing the guitar, and binge watching law/crime shows. Feel free to reach out throughout the quarter! :)</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/GaurangPendharkar.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Gaurang Pendharkar</li>
                <li>gaurap [at] cs.washington.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <li>Hello, I’m Gaurang! I’m a BS/MS student at UW currently from Renton, WA. This is my 2nd time teaching CSE 312, and it has remained one of my favorite courses at the Allen school. Outside of class, I love reading, games, traveling, and movies. My research interests include computational biology and AI4Math. Looking forward to this quarter and meeting y’all!</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/JackScott.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Jack Scott</li>
                <li>jscott26 [at] cs.washington.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <!-- TODO: office hours -->
                <li>Hi everyone, I'm Jack and I'm a senior studying CS! I am very excited to be TA'ing 312 this quarter. Also, a fun fact is that I was in San Francisco this summer and went on a lot of hikes. If you have any questions about anything then feel free to reach out or come to office hours :)</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/SamSullivan.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Sam Sullivan</li>
                <li>samues28 [at] uw.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <li>Hey, I'm Sam. I'm a BS/MS student this year, and this is my second time TAing for CSE 312. I like board and card games and most aspects of the Pokémon TCG. Feel free to reach out to me with any questions about the course, life at UW, career, Pokémon, or anything else!</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/MayeeSun.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Mayee Sun</li>
                <li>mayeesun [at] cs.washington.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <!-- TODO: office hours -->
                <li>Hi everyone! I'm Mayee, a senior double majoring in Computer Science and Mathematics. In my free time, I like to play tennis, volleyball, run, and bake. Super excited to meet everyone this quarter!</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/GlennSun.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Glenn Sun</li>
                <li>glennsun [at] cs.washington.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <li>Hi, my name is Glenn. I'm a 4th year PhD student in the theory group, currently working on SAT solving, which is a general framework for solving many NP-complete problems in a reasonable amount of time. Non-academically, I enjoy cooking, all kinds of transportation, and thinking about government and policy. Excited to get to know all of you, and I'm always happy to help if you have questions.</li>
            </ul>
        </div>

<div class="staff-member row">
            <div class="profile-pic col-4 col-sm-3 col-md-2">
                <img src="files/staff/TobyThornburg.jpg" />
            </div>
            <ul class="info col">
                <li class="name">Toby Thornburg</li>
                <li>tthornb1 [at] cs.washington.edu</li>
                <!-- TODO: pronouns -->
                <!-- TODO: section -->
                <!-- TODO: office hours -->
                <li>Hi! I'm an MS student in the theory and quantum groups. I love playing sports and hiking in the Cascades. Come talk about 312, theory, or whatever's on your mind!</li>
            </ul>
        </div>




</div>
	    </div>
            </div>
       </div>
    </div>
    
    <script src="assets/vendors/jquery-3.1.1.slim.min.js"></script>
    <script src="assets/vendors/bootstrap-4.0.0-beta.2.bundle.min.js"></script>

</body>
</html>
