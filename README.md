# URL image crawler

## How it works

1.  User POSTs to /jobs
1.  API dispatches a job to the queue with given urls at level 0 and returns the job id
1.  Job queue picks up the startCrawl job, adds its urls to the db, and dispatches a stepCrawl job
1.  Job queue picks up the stepCrawl job, which looks for a pending url to crawl
1.  If a pending url is found, it is parsed for images
1.  If its level is < MAX_DEPTH it is also parsed for links to follow, added to the queue at level + 1
1.  After completion of a url, another stepCrawl job is dispatched
1.  User can GET /jobs/:job_id/status/ to view progress
1.  This repeats until all urls are completed
1.  Upon completion, results are calculated and cached
1.  User can GET /jobs/:job_id/results/ to view results

## Demo considerations

* Little error checking/handling
* Not a durable or feature rich queue
* Fetched urls are cached indefintely to avoid pegging external sites

## Todo / Improvements

* The status response could contain a `status: "complete|pending"`
  but is not part of the spec, so not implemented. Checking `pending === 0` is
  not guaranteed to be correct.

## Running

Spin up redis and the crawler api:

```
docker-compose up
```

Access redis-cli:

```
docker-compose run redis redis-cli -h redis
```

Run the demo (src/demo.js):

```
docker-compose run api yarn run demo
```

Here is the console output from the demo: [Demo output](DEMO_OUTPUT.txt)

## SPEC

Parse given urls and their immediate links for images (gif/jpg/png only).

This request triggers the crawling. The result should be HTTP status 202, with a job_id in result; this should be in the form:

```
$ curl -X POST -H 'Content-Type: application/json' -d '{"urls": ["https://google.com", "https://www.statuspage.io", "https://travis-ci.org"]}'  http://myapp.domain.tld/jobs

{
  'id': 'UNIQUE_JOB_ID'
}
```

We will need to be able to see what is happening with a job ID (UNIQUE_JOB_ID in this example):
The output of this request should show us how many crawls are in progress and how many have completed:

```
$ curl -X GET http://myapp.domain.tld/jobs/UNIQUE_JOB_ID/status/

{
  'id': 'UNIQUE_JOB_ID',
  'status': {
    'completed': 1,
    'inprogress': 2
  }
}
```

It's also a requirement that we be able to get the results of a job id once it has completed:
The response needs to be a list of the URLs crawled and a list of each image found on that domain:

```
$ curl http://myapp.domain.tld/jobs/UNIQUE_JOB_ID/results/

{
  'id': 'UNIQUE_JOB_ID',
  'results': {
    'https://google.com/preferences?hl=en': [
      'https://google.com/images/logo_sm_2.gif',
      'https://google.com/images/warning.gif'
    ],
    'https://www.statuspage.io': [
      'https://dka575ofm4ao0.cloudfront.net/assets/base/favicon-
b756db379a57687bdfa58f6bac32bec2.png',
      'https://dka575ofm4ao0.cloudfront.net/assets/base/apple-touch-icon-
144x144-precomposed-293c39b0635ae7523612fe7488be9244.png'
    ],
    'https://travis-ci.org/': [
      'https://cdn.travis-ci.org/images/landing-page/laptop-
184c9a5cfd62d0395bb388b79dd719f3.png'
] }
}
```
