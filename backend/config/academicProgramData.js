const programs = [
  { registrationCode: 'cs', programCode: 'CSE', displayName: 'Computer Science and Engineering', departmentCode: 'CSE', officialDepartmentUrl: 'https://www.satiengg.in/departments/computer-science-engineering' },
  { registrationCode: 'bc', programCode: 'CSE_BC', displayName: 'Computer Science and Engineering (Blockchain)', departmentCode: 'CSE', officialDepartmentUrl: 'https://www.satiengg.in/departments/computer-science-engineering' },
  { registrationCode: 'ai', programCode: 'CSE_AIML', displayName: 'Computer Science and Engineering (Artificial Intelligence and Machine Learning)', departmentCode: 'AI', officialDepartmentUrl: 'https://www.satiengg.in/departments/artificial-intelligence' },
  { registrationCode: 'ds', programCode: 'CSE_AIADS', displayName: 'Computer Science and Engineering (Artificial Intelligence and Data Science)', departmentCode: 'AI', officialDepartmentUrl: 'https://www.satiengg.in/departments/artificial-intelligence' },
  { registrationCode: 'it', programCode: 'IT', displayName: 'Information Technology', departmentCode: 'IT', officialDepartmentUrl: 'https://www.satiengg.in/departments/information-technology' },
  { registrationCode: 'iot', programCode: 'CSE_IOT', displayName: 'Computer Science and Engineering (Internet of Things)', departmentCode: 'CSIOT', officialDepartmentUrl: null },
  { registrationCode: 'ec', programCode: 'ECE', displayName: 'Electronics and Communication Engineering', departmentCode: 'ECE', officialDepartmentUrl: null },
  { registrationCode: 'ce', programCode: 'CE', displayName: 'Civil Engineering', departmentCode: 'CE', officialDepartmentUrl: 'https://www.satiengg.in/departments/civil-engineering' },
  { registrationCode: 'me', programCode: 'ME', displayName: 'Mechanical Engineering', departmentCode: 'ME', officialDepartmentUrl: null },
  { registrationCode: 'ee', programCode: 'EE', displayName: 'Electrical Engineering', departmentCode: 'EE', officialDepartmentUrl: 'https://www.satiengg.in/departments/electrical-engineering' }
].map((program) => Object.freeze({ ...program, aliases: Object.freeze([program.registrationCode]), active: true, supported: true }));

export const academicPrograms = Object.freeze(programs);
