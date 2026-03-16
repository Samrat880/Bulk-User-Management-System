// In-memory job store for tracking background upload progress
const jobs = new Map();

export const createJob = (id) => {
  const job = {
    id,
    status: "processing",
    total: 0,
    processed: 0,
    failed: 0,
    errors: [],
    createdAt: new Date(),
  };
  jobs.set(id, job);
  return job;
};

export const getJob = (id) => {
  return jobs.get(id);
};

export const updateJob = (id, updates) => {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, updates);
  }
  return job;
};
