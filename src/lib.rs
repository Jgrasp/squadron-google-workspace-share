use serde::Deserialize;
use squadron_extension_api::{Agent, Extension, host, squadron_extension};

struct WorkspaceShare;

#[derive(Deserialize)]
struct Artifact {
    id: String,
    dir: String,
    entry: String,
}

#[derive(Deserialize)]
struct Input {
    artifact: Artifact,
    data: String,
    #[serde(default)]
    delete: bool,
}

fn work(input: &Input, agent: &Agent) -> String {
    format!("{}/sites/{}-{}", input.data, agent.id, input.artifact.id)
}

fn python(args: Vec<String>, dir: &str) -> Result<String, String> {
    let out = host::exec("python3", &args, Some(dir))?;
    if out.code != 0 {
        return Err(out.stderr.trim().lines().last().unwrap_or("share.py failed").to_string());
    }
    Ok(out.stdout)
}

impl Extension for WorkspaceShare {
    fn call_tool(name: String, input: String, agent: Option<Agent>) -> Result<String, String> {
        let input: Input = serde_json::from_str(&input).map_err(|e| e.to_string())?;
        let agent = agent.ok_or("No agent for this artifact.")?;
        let work = work(&input, &agent);
        let script = format!("{work}/kit/scripts/share.py");
        match name.as_str() {
            "update" => {
                let source = format!("{}/{}", input.artifact.dir, input.artifact.entry);
                let out = python(vec![script, "update".into(), work.clone(), source], &work)?;
                out.lines()
                    .rev()
                    .find(|l| l.starts_with("https://"))
                    .map(str::to_string)
                    .ok_or_else(|| "share.py gave no link.".into())
            }
            "unshare" => {
                let mut args = vec![script, "stop".into(), work.clone()];
                if input.delete {
                    args.push("--delete".into());
                }
                python(args, &work).map(|_| String::new())
            }
            _ => Err(format!("Unknown tool {name}.")),
        }
    }
}

squadron_extension!(WorkspaceShare);
