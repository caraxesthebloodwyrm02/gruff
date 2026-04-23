use actix_web::{web, HttpResponse, Result};

use crate::grid::GridConfig;

pub async fn index() -> Result<HttpResponse> {
    let html = include_str!("../static/index.html");
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html))
}

pub async fn api_grid(config: web::Data<GridConfig>) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .json(config.as_ref()))
}

pub async fn static_file(path: web::Path<String>) -> Result<HttpResponse> {
    match path.as_str() {
        "notebook.js" => {
            let js = include_str!("../static/notebook.js");
            Ok(HttpResponse::Ok()
                .content_type("application/javascript")
                .body(js))
        }
        _ => Ok(HttpResponse::NotFound().body("Not found")),
    }
}
