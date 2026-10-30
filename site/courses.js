/* The course catalog. The landing page and every week's course/week switcher are built from this.
   To add a week: add { id: "wNN", title, dates, posted: true } to its course and create site/<course>/wNN/. */
window.COURSES = {
  term: "Autumn 2026",
  courses: [
    {
      id: "cse331", short: "331", name: "CSE 331", title: "Software Design and Implementation",
      home: "https://courses.cs.washington.edu/courses/cse331/26au/",
      weeks: [
        { id: "w01", title: "Assertions and specifications", dates: "Sep 30 – Oct 2", posted: true },
        { id: "w02", title: "Batch programs and their users", dates: "Oct 5 – Oct 9", posted: true },
        { id: "w03", title: "Error handling and Floyd-Hoare logic", dates: "Oct 12 – Oct 16", posted: true },
        { id: "w04", dates: "Oct 19 – Oct 23" },
        { id: "w05", dates: "Oct 26 – Oct 30" },
        { id: "w06", dates: "Nov 2 – Nov 6" },
        { id: "w07", dates: "Nov 9 – Nov 13" },
        { id: "w08", dates: "Nov 16 – Nov 20" },
        { id: "w09", dates: "Nov 23 – Nov 27" },
        { id: "w10", dates: "Nov 30 – Dec 4" },
      ],
    },
    {
      id: "cse332", short: "332", name: "CSE 332", title: "Data Structures and Parallelism",
      home: "https://courses.cs.washington.edu/courses/cse332/26au/",
      weeks: [
        { id: "w01", title: "ADTs, queues & stacks · algorithm analysis", dates: "Sep 30 – Oct 2", posted: true },
        { id: "w02", title: "Growth, compared", dates: "Oct 5 – Oct 9", posted: true },
        { id: "w03", title: "Recurrences and search trees", dates: "Oct 12 – Oct 16", posted: true },
        { id: "w04", title: "AVL trees and hashing", dates: "Oct 19 – Oct 23", posted: true },
        { id: "w05", dates: "Oct 26 – Oct 30" },
        { id: "w06", dates: "Nov 2 – Nov 6" },
        { id: "w07", dates: "Nov 9 – Nov 13" },
        { id: "w08", dates: "Nov 16 – Nov 20" },
        { id: "w09", dates: "Nov 23 – Nov 27" },
        { id: "w10", dates: "Nov 30 – Dec 4" },
      ],
    },
  ],
};
