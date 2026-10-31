use serde::{Serialize, Serializer, ser::SerializeStruct};

/// Errors returned to the frontend. They serialize as `{ code, detail }`; the frontend
/// translates `code` (see `errors.*` in the locale files) and may show `detail`.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("not a Tiza file")]
    NotTiza,
    #[error("invalid document: {0}")]
    InvalidDocument(String),
    #[error("the file was made with a newer version of Tiza (format {0})")]
    TooNew(u32),
    #[error("file too large")]
    TooLarge,
    #[error("unsafe path inside the file: {0}")]
    UnsafePath(String),
    #[error("the file name must end in .tiza")]
    BadExtension,
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Io(_) => "file.io",
            AppError::NotTiza => "file.notTiza",
            AppError::InvalidDocument(_) => "file.invalid",
            AppError::TooNew(_) => "file.tooNew",
            AppError::TooLarge => "file.tooLarge",
            AppError::UnsafePath(_) => "file.unsafePath",
            AppError::BadExtension => "file.badExtension",
        }
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(err: zip::result::ZipError) -> Self {
        match err {
            zip::result::ZipError::Io(e) => AppError::Io(e),
            _ => AppError::NotTiza,
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("detail", &self.to_string())?;
        s.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
