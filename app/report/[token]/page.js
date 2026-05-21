import SharedReportPage from '../../shared/[slug]/page';

export default function ReportTokenPage(props) {
  const token = props?.params?.token;
  return <SharedReportPage params={Promise.resolve({ slug: token })} />;
}
