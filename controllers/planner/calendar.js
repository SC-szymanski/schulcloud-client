const api = require("../../api");
const {
  getUTCDate,
  getFederalState,
  getHolidays,
  getFirstSommerHolidays,
  getCurrentSchoolYearId
} = require("./helper");

// topics: [
//   {
//     id: "Thema 1",
//     text: "Thema 1",
//     color: "#92DB92",
//     utcStartDate: 1534723200000,
//     utcEndDate: 1535932799999
//   },
//   {
//     id: "Thema 2",
//     text: "Thema 2",
//     color: "#92DB92",
//     utcStartDate: 1535932800000,
//     utcEndDate: 1539561599999
//   },
//   {
//     id: "Thema 3",
//     text: "Thema 3",
//     color: "#92DB92",
//     utcStartDate: 1539561600000,
//     utcEndDate: 1541980799999
//   }
// ]

const DUMMY_OTHER_DATA = [
  {
    name: "Projektwoche",
    color: "#e9e8e8",
    utcStartDate: 1548633600000,
    utcEndDate: 1548979200000
  }
];

const DAY = 1000 * 60 * 60 * 24;

const getCurrentSchoolYear = async (req, stateCode) => {
  const today = new Date();
  const currentYearHolidays = await getHolidays(req, {
    year: today.getFullYear(),
    stateCode
  });
  const currentYearSummerHolidays = getFirstSommerHolidays(currentYearHolidays);
  const middleOfSummerHolidays = Math.round(
    (Date.parse(currentYearSummerHolidays.start) +
      Date.parse(currentYearSummerHolidays.end)) /
      2
  );
  /* If current time is smaller than middle of summer holidays,
    -> schoolyear = determined by summer holidays from this year (e.g. 18) and last year (e.g. 17)
    Otherwise
    -> schoolyear = determined by summer holidays from this year (e.g. 18) and next year (e.g. 19)
  */
  if (today.getTime() < middleOfSummerHolidays) {
    const previousYear = today.getFullYear() - 1;
    const previousYearHolidays = await getHolidays(req, {
      year: previousYear,
      stateCode
    });
    const previousYearSummerHolidays = getFirstSommerHolidays(
      previousYearHolidays
    );
    return {
      // School year start date is end of summer holidays + one day
      utcStartDate: previousYearSummerHolidays.utcEndDate + DAY,
      // School year end date is start of summer holidays - one day
      utcEndDate: currentYearSummerHolidays.utcStartDate - DAY
    };
  } else {
    const nextYear = today.getFullYear() + 1;
    const nextYearHolidays = await getHolidays(req, {
      year: nextYear,
      stateCode
    });
    const nextYearSummerHolidays = getFirstSommerHolidays(nextYearHolidays);
    return {
      utcStartDate: currentYearSummerHolidays.utcEndDate + DAY,
      utcEndDate: nextYearSummerHolidays.utcStartDate - DAY
    };
  }
};

const getHolidaysData = async (req, { schoolYear, stateCode }) => {
  const firstYear = new Date(schoolYear.utcStartDate).getFullYear();
  const secondYear = new Date(schoolYear.utcEndDate).getFullYear();
  const firstYearHolidays = await getHolidays(req, {
    year: firstYear,
    stateCode
  });
  const secondYearHolidays = await getHolidays(req, {
    year: secondYear,
    stateCode
  });
  const holidays = [...firstYearHolidays, ...secondYearHolidays];

  return holidays.filter(
    holiday =>
      holiday.utcEndDate > schoolYear.utcStartDate &&
      holiday.utcStartDate < schoolYear.utcEndDate
  );
};

const normalizeCourseData = courses => {
  return courses.reduce((relevantCourseData, course) => {
    // A course must have at least one assigned class
    const courseClass = course.classIds[0];
    // If a class has no year assigned, we ignore it
    const courseData = {
      id: course._id,
      name: course.name,
      ...(course.subjectId
        ? {
            subjectId: course.subjectId._id,
            subjectName: course.subjectId.label
          }
        : {
            subjectId: "",
            subjectName: "Nicht zugeordnet"
          })
    };
    const courseClassData = {
      classId: courseClass._id,
      ...(courseClass.gradeLevel
        ? {
            classLevel: courseClass.gradeLevel.name,
            className: `${courseClass.gradeLevel.name}${courseClass.name}`
          }
        : { classLevel: "Nicht zugeordnet", className: courseClass.name })
    };
    relevantCourseData.push({
      ...courseData,
      ...courseClassData
    });
    return relevantCourseData;
  }, []);
};
const populateClassesWithTopics = async flattenedCourses => {
  const coursePromises = flattenedCourses.map(course => {
    // API CALL for topic instance mit course.id
    return new Promise(res => res([]));
  });
  const topicInstanceData = await Promise.all(coursePromises);
  return flattenedCourses.map((course, index) => ({
    ...course,
    // topicInstanceData has to be transformed here -> startIndex/endIndex
    topics: topicInstanceData[index]
  }));
};
const transformToAPIShape = coursesWithTopics => {
  const classTopicsData = coursesWithTopics.reduce((classMap, course) => {
    if (!classMap[course.classId])
      classMap[course.classId] = {
        className: course.className,
        classes: []
      };
    classMap[course.classId].classes.push({
      subjectId: course.subjectId,
      subjectName: course.subjectName,
      topics: course.topics
    });

    return classMap;
  }, {});

  return Object.values(classTopicsData);
};
const getClassTopicsData = async (req, schoolYear) => {
  const schoolYearId = await getCurrentSchoolYearId(req, schoolYear);
  const courseData = await api(req).get("/courses", {
    qs: {
      $populate: [
        {
          path: "classIds",
          match: { year: schoolYearId },
          populate: ["gradeLevel"]
        },
        "subjectId"
      ]
    }
  });
  // Filter all courses without classes (because of the query,
  // these are the course that do not take place this school year)
  const courses = courseData.data.filter(course => course.classIds.length > 0);
  // Prepare the data for following operations + sort based on classLevel
  const normalizedCourses = normalizeCourseData(courses).sort(
    (courseA, courseB) => courseA.classLevel.localeCompare(courseB.classLevel)
  );
  const coursesWithTopics = await populateClassesWithTopics(normalizedCourses);

  return transformToAPIShape(coursesWithTopics);
};

const handleGetCalendar = async (req, res, next) => {
  const utcToday = getUTCDate(new Date());
  const schoolId = res.locals.currentUser.schoolId;
  const stateCode = await getFederalState(req, schoolId);
  const schoolYear = await getCurrentSchoolYear(req, stateCode);
  const holidaysData = await getHolidaysData(req, { schoolYear, stateCode });
  const classTopicsData = await getClassTopicsData(req, schoolYear);

  res.render("planner/calendar", {
    title: "Kalender",
    schoolYear: JSON.stringify(schoolYear),
    utcToday,
    classTopicsData: JSON.stringify(classTopicsData),
    holidaysData: JSON.stringify(holidaysData),
    otherEventsData: JSON.stringify(DUMMY_OTHER_DATA)
  });
};

module.exports = {
  getCalendar: handleGetCalendar
};