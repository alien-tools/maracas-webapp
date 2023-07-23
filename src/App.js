import React, { useState, useMemo } from 'react';
import { Container, Form, Button, Alert, Card, Spinner, Table, Col, Row } from 'react-bootstrap';
import axios from 'axios';

function repositoryLink(url) {
  return <a href={url}>{url.replace('https://github.com/', '')}</a>;
}

function ModuleReport({report}) {
  return (
      <Card className="mb-3">
        <Card.Header><h3>Report for module <code>{report.id}</code></h3></Card.Header>
        {report.delta ?
            <>
              <Card.Body>
                <p>This module is affected by {report.delta.breakingChanges.length} breaking changes that impact {report.clientReports.filter((client) => client.brokenUses.length > 0).length} clients.</p>
                <Table striped bordered hover responsive className="mb-3">
                  <thead>
                  <tr>
                    <th>Affected Declaration</th>
                    <th>Breaking Change</th>
                    <th>Status</th>
                    <th>Impacted Clients</th>
                    <th>Broken Locations</th>
                  </tr>
                  </thead>
                  <tbody>
                  {report.delta.breakingChanges.map((breakingChange, index) => {
                    const affectedClients = report.clientReports.filter(client =>
                        client.brokenUses.some(brokenUse => brokenUse.src === breakingChange.declaration));
                    const brokenLocations = affectedClients.reduce((sum, client) =>
                        sum + client.brokenUses.filter(brokenUse => brokenUse.src === breakingChange.declaration).length, 0);

                    return (
                        <tr key={index}>
                          <td><a href={breakingChange.fileUrl}><code>{breakingChange.declaration}</code></a> [<a href={breakingChange.diffUrl}>diff</a>]</td>
                          <td><code>{breakingChange.change}</code></td>
                          <td>{brokenLocations > 0 ? <span class="badge rounded-pill large-pill text-bg-danger">Breaks clients</span> : <span className="badge rounded-pill large-pill text-bg-warning">No broken client</span>}</td>
                          <td>{affectedClients.length > 0 ? `${affectedClients.length} (${affectedClients.map(client => client.url).join(', ')})` : <span className="badge rounded-pill large-pill text-bg-success">None</span>}</td>
                          <td>{brokenLocations > 0 ? <span className="badge rounded-pill large-pill text-bg-danger">{brokenLocations}</span> : <span className="badge rounded-pill large-pill text-bg-success">None</span>}</td>
                        </tr>
                    );
                  })}
                  </tbody>
                </Table>
              </Card.Body>
            </>
        : <Card.Body>
              <p>An error was encountered while analyzing the module: {report.error}</p>
          </Card.Body>
        }
      </Card>
  );
}

function ClientReport({clientUrl, brokenUses}) {
  return (
      <Card className="mb-3">
        <Card.Header><h3>Impact on client <a href={clientUrl}>{repositoryLink(clientUrl)}</a></h3></Card.Header>
        <Card.Body>
          <div id={`client-report`}>
            <Table striped bordered hover responsive className="mb-3">
              <thead>
              <tr>
                <th>Location</th>
                <th>Element</th>
                <th>Breaking Declaration</th>
                <th>Kind</th>
                <th>Usage</th>
              </tr>
              </thead>
              <tbody>
              {brokenUses.map((brokenUse, index) => (
                  <tr key={index}>
                    <td><a href={brokenUse.url}><code>{brokenUse.path}:{brokenUse.startLine}-{brokenUse.endLine}</code></a></td>
                    <td><code>{brokenUse.elem}</code></td>
                    <td><code>{brokenUse.src}</code></td>
                    <td><code>{brokenUse.change}</code></td>
                    <td><code>{brokenUse.apiUse}</code></td>
                  </tr>
              ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
  );
}

function ImpactSummary({ clientReports }) {
  return (
      <Card className="mb-3">
        <Card.Header><h3>Impact Summary</h3></Card.Header>
        <Card.Body>
          <Table striped bordered hover responsive className="mb-3">
            <thead>
            <tr>
              <th>Client</th>
              <th>Status</th>
            </tr>
            </thead>
            <tbody>
            {Object.entries(clientReports).map(([clientUrl, brokenUses], index) => (
                <tr key={index}>
                  <td><a href={clientUrl}>{repositoryLink(clientUrl)}</a></td>
                  <td>
                    {brokenUses.length > 0
                        ? <span className="badge rounded-pill large-pill text-bg-danger">{brokenUses.length} broken uses</span>
                        : <span className="badge rounded-pill large-pill text-bg-success">Not Broken</span>}
                  </td>
                </tr>
            ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
  );
}

function App() {
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setError(null);
    setResponse(null);
    setLoading(true);

    try {
      const res = await axios.post(`https://api.breakbot.net/github/pr-sync/${owner}/${name}/${number}`);

      if (res.status !== 200) {
        setError(res.data.message);
      } else {
        setResponse(res.data);
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const clientReports = useMemo(() => {
    if (!response?.report) return {};

    let clientReports = {};
    response.report.reports.forEach(report => {
      report.delta?.breakingChanges.forEach(breakingChange => {
        report.clientReports.forEach(clientReport => {
          clientReport.brokenUses.forEach(brokenUse => {
            if (brokenUse.src === breakingChange.declaration) {
              if (!clientReports[clientReport.url]) {
                clientReports[clientReport.url] = [];
              }

              clientReports[clientReport.url].push({
                ...brokenUse,
                change: breakingChange.change,
              });
            }
          });
        });
      });
    });

    return clientReports;
  }, [response]);

  return (
      <Container>
        <Row className="justify-content-md-center">
          <h1>Will this pull request break my clients?</h1>
        </Row>
        <Row className="justify-content-md-center">
          <p>
            Maracas and BreakBot can check any pull request on a library hosted on GitHub for the introduction of
            breaking changes and their impact on client projects. Enter the information about the pull request you'd like
            to analyze in the form below.
          </p>
        </Row>
        <Row>
          <Form className="mb-3">
            <Row>
              <Col>
                <Form.Group controlId="github-owner" className="mb-3">
                  <Form.Control disabled={loading} required type="text" placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="github-name" className="mb-3">
                  <Form.Control disabled={loading} required type="text" placeholder="Repository" value={name} onChange={(e) => setName(e.target.value)} />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="github-pr-number" className="mb-3">
                  <Form.Control disabled={loading} required type="text" placeholder="Pull Request Number" value={number} onChange={(e) => setNumber(e.target.value)} />
                </Form.Group>
              </Col>
              <Col className="mb-3">
                <Button variant="primary" onClick={handleAnalyze} disabled={loading}>
                  {loading ? <Spinner animation="border" size="sm" /> : 'Analyze'}
                </Button>
              </Col>
            </Row>
          </Form>
        </Row>
        <Row>
          {response &&
            <Col className="col-xl-2 order-xl-1 order-0">
              <aside className="sticky-xl-top">
                <img className="img-fluid my-3" src="bb-logo.png" alt="BreakBot Logo" />
                <div className="p-3 bg-light rounded">
                  <h2 className="fst-italic">About</h2>
                  <p>
                    This report has been produced with BreakBot and Maracas! If you encounter any bug in the analysis
                    results, please report them to <a href="https://github.com/alien-tools/maracas">Maracas</a> developers; if you encounter any bug
                    in the GitHub App, please report them to <a href="https://github.com/alien-tools/breakbot">BreakBot</a> developers.
                  </p>
                </div>
                <p>This report was generated on {new Date(response.date).toString()}</p>
              </aside>
            </Col>
          }
          <Col>
            {response?.pr &&
                <Card className="mb-3" id="#summary">
                  <Card.Header><h3>Summary</h3></Card.Header>
                  <Card.Body>
                    We analyzed <mark>{response.pr.headBranch}</mark> (commit {response.pr.headSha.substring(0, 6)}) against <mark>{response.pr.baseBranch}</mark> (commit {response.pr.baseSha.substring(0, 6)})
                    and found {response.report.reports.filter((report) => report.delta).length} impacted modules for a total of {response.report.reports.filter((report) => report.delta).reduce((sum, report) => sum + report.delta.breakingChanges.length, 0)} breaking changes.<br/>
                     {Object.keys(clientReports).length} clients are impacted.
                  </Card.Body>
                </Card>
            }

            {error && <Alert variant="danger">{error}</Alert>}

            {response?.report?.reports.map((report, index) => (
                <ModuleReport report={report} key={index} />
            ))}

            {response?.report &&
                <ImpactSummary clientReports={clientReports} />
            }

            {Object.entries(clientReports).map(([clientUrl, brokenUses], index) => (
                <ClientReport clientUrl={clientUrl} brokenUses={brokenUses} key={index} />
            ))}
          </Col>
        </Row>
      </Container>
  );
}

export default App;
